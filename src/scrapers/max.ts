import buildUrl from 'build-url';
import moment, { type Moment } from 'moment';
import { type Page } from 'puppeteer';
import { DOLLAR_CURRENCY, EURO_CURRENCY, SHEKEL_CURRENCY } from '../constants';
import getAllMonthMoments from '../helpers/dates';
import { getDebug } from '../helpers/debug';
import { clickButton, elementPresentOnPage, waitUntilElementFound } from '../helpers/elements-interactions';
import { fetchGetWithinPage, fetchPostWithinPage } from '../helpers/fetch';
import { waitForRedirect } from '../helpers/navigation';
import { filterOldTransactions, fixInstallments, sortTransactionsByDate } from '../helpers/transactions';
import {
  type CardBlockType,
  TransactionStatuses, type TransactionsAccount, TransactionTypes, type Transaction,
} from '../transactions';
import {
  BaseScraperWithBrowser,
  LoginResults,
  type LoginOptions,
  type PossibleLoginResults,
} from './base-scraper-with-browser';
import { type ScraperOptions } from './interface';

const debug = getDebug('max');

// todo: Handle incorrect password - undefined error
export interface ScrapedTransaction {
  shortCardNumber: string;
  paymentDate?: string;
  purchaseDate: string;
  actualPaymentAmount: string;
  paymentCurrency: number | null;
  originalCurrency: string;
  originalAmount: number;
  planName: string;
  planTypeId: number;
  comments: string;
  merchantName: string;
  categoryId: number;
  fundsTransferComment?: string;
  fundsTransferReceiverOrTransfer?: string;
  dealData?: {
    arn: string;
  };
}

const BASE_API_ACTIONS_URL = 'https://onlinelcapi.max.co.il';
const BASE_WELCOME_URL = 'https://www.max.co.il';

const LOGIN_URL = `${BASE_WELCOME_URL}/homepage/welcome`;
const PASSWORD_EXPIRED_URL = `${BASE_WELCOME_URL}/renew-password`;
const SUCCESS_URL = `${BASE_WELCOME_URL}/homepage/personal`;

enum MaxPlanName {
  Normal = 'רגילה',
  ImmediateCharge = 'חיוב עסקות מיידי',
  InternetShopping = 'אינטרנט/חו"ל',
  Installments = 'תשלומים',
  MonthlyCharge = 'חיוב חודשי',
  OneMonthPostponed = 'דחוי חודש',
  MonthlyPostponed = 'דחוי לחיוב החודשי',
  MonthlyPayment = 'תשלום חודשי',
  FuturePurchaseFinancing = 'מימון לרכישה עתידית',
  MonthlyPostponedInstallments = 'דחוי חודש תשלומים',
  ThirtyDaysPlus = 'עסקת 30 פלוס',
  TwoMonthsPostponed = 'דחוי חודשיים',
  TwoMonthsPostponed2 = 'דחוי 2 ח\' תשלומים',
  MonthlyChargePlusInterest = 'חודשי + ריבית',
  Credit = 'קרדיט',
  CreditOutsideTheLimit = 'קרדיט-מחוץ למסגרת',
  AccumulatingBasket = 'סל מצטבר',
  PostponedTransactionInstallments = 'פריסת העסקה הדחויה',
  ReplacementCard = 'כרטיס חליפי',
  EarlyRepayment = 'פרעון מוקדם',
  MonthlyCardFee = 'דמי כרטיס',
  CurrencyPocket = 'חיוב ארנק מטח',
}

const INVALID_DETAILS_SELECTOR = '#popupWrongDetails';
const LOGIN_ERROR_SELECTOR = '#popupCardHoldersLoginError';

const categories = new Map<number, string>();

function redirectOrDialog(page: Page) {
  return Promise.race([
    waitForRedirect(page, 20000, false, [BASE_WELCOME_URL, `${BASE_WELCOME_URL}/`]),
    waitUntilElementFound(page, INVALID_DETAILS_SELECTOR, true),
    waitUntilElementFound(page, LOGIN_ERROR_SELECTOR, true),
  ]);
}

function getTransactionsUrl(monthMoment: Moment) {
  const month = monthMoment.month() + 1;
  const year = monthMoment.year();
  const date = `${year}-${month}-01`;

  /**
     * url explanation:
     * userIndex: -1 for all account owners
     * cardIndex: -1 for all cards under the account
     * all other query params are static, beside the date which changes for request per month
     */
  return buildUrl(BASE_API_ACTIONS_URL, {
    path: `/api/registered/transactionDetails/getTransactionsAndGraphs?filterData={"userIndex":-1,"cardIndex":-1,"monthView":true,"date":"${date}","dates":{"startDate":"0","endDate":"0"},"bankAccount":{"bankAccountIndex":-1,"cards":null}}&firstCallCardIndex=-1`,
  });
}

interface FetchCategoryResult {
  result? : Array<{
    id: number;
    name: string;
  }>;
}

async function loadCategories(page: Page) {
  debug('Loading categories');
  const res = await fetchGetWithinPage<FetchCategoryResult>(page, `${BASE_API_ACTIONS_URL}/api/contents/getCategories`);
  if (res && Array.isArray(res.result)) {
    debug(`${res.result.length} categories loaded`);
    res.result?.forEach(({ id, name }) => categories.set(id, name));
  }
}

function getTransactionType(planName: string, planTypeId: number) {
  const cleanedUpTxnTypeStr = planName.replace('\t', ' ').trim() as MaxPlanName;
  switch (cleanedUpTxnTypeStr) {
    case MaxPlanName.ImmediateCharge:
    case MaxPlanName.Normal:
    case MaxPlanName.MonthlyCharge:
    case MaxPlanName.OneMonthPostponed:
    case MaxPlanName.MonthlyPostponed:
    case MaxPlanName.FuturePurchaseFinancing:
    case MaxPlanName.MonthlyPayment:
    case MaxPlanName.MonthlyPostponedInstallments:
    case MaxPlanName.ThirtyDaysPlus:
    case MaxPlanName.TwoMonthsPostponed:
    case MaxPlanName.TwoMonthsPostponed2:
    case MaxPlanName.AccumulatingBasket:
    case MaxPlanName.InternetShopping:
    case MaxPlanName.MonthlyChargePlusInterest:
    case MaxPlanName.PostponedTransactionInstallments:
    case MaxPlanName.ReplacementCard:
    case MaxPlanName.EarlyRepayment:
    case MaxPlanName.MonthlyCardFee:
    case MaxPlanName.CurrencyPocket:
      return TransactionTypes.Normal;
    case MaxPlanName.Installments:
    case MaxPlanName.Credit:
    case MaxPlanName.CreditOutsideTheLimit:
      return TransactionTypes.Installments;
    default:
      switch (planTypeId) {
        case 2:
        case 3:
          return TransactionTypes.Installments;
        case 5:
          return TransactionTypes.Normal;
        default:
          throw new Error(`Unknown transaction type ${cleanedUpTxnTypeStr as string}`);
      }
  }
}

function getInstallmentsInfo(comments: string) {
  if (!comments) {
    return undefined;
  }
  const matches = comments.match(/\d+/g);
  if (!matches || matches.length < 2) {
    return undefined;
  }

  return {
    number: parseInt(matches[0], 10),
    total: parseInt(matches[1], 10),
  };
}

function getChargedCurrency(currencyId: number | null) {
  switch (currencyId) {
    case 376:
      return SHEKEL_CURRENCY;
    case 840:
      return DOLLAR_CURRENCY;
    case 978:
      return EURO_CURRENCY;
    default:
      return undefined;
  }
}

export function getMemo({
  comments, fundsTransferReceiverOrTransfer, fundsTransferComment,
}: Pick<ScrapedTransaction, 'comments' | 'fundsTransferReceiverOrTransfer' | 'fundsTransferComment'>) {
  if (fundsTransferReceiverOrTransfer) {
    const memo = comments ? `${comments} ${fundsTransferReceiverOrTransfer}` : fundsTransferReceiverOrTransfer;
    return fundsTransferComment ? `${memo}: ${fundsTransferComment}` : memo;
  }

  return comments;
}

function mapTransaction(rawTransaction: ScrapedTransaction): Transaction {
  const isPending = rawTransaction.paymentDate === null;
  const processedDate = moment(isPending ?
    rawTransaction.purchaseDate :
    rawTransaction.paymentDate ?? rawTransaction.purchaseDate).toISOString();
  const status = isPending ? TransactionStatuses.Pending : TransactionStatuses.Completed;

  const installments = getInstallmentsInfo(rawTransaction.comments);
  const identifier = installments ?
    `${rawTransaction.dealData?.arn}_${installments.number}` :
    rawTransaction.dealData?.arn;

  return {
    type: getTransactionType(rawTransaction.planName, rawTransaction.planTypeId),
    date: moment(rawTransaction.purchaseDate).toISOString(),
    processedDate,
    originalAmount: -rawTransaction.originalAmount,
    originalCurrency: rawTransaction.originalCurrency,
    chargedAmount: -rawTransaction.actualPaymentAmount,
    chargedCurrency: getChargedCurrency(rawTransaction.paymentCurrency),
    description: rawTransaction.merchantName.trim(),
    memo: getMemo(rawTransaction),
    category: categories.get(rawTransaction?.categoryId),
    installments,
    identifier,
    status,
  };
}
interface ScrapedTransactionsResult {
  result?: {
    transactions: ScrapedTransaction[];
  };
}

const ActionsTitle = {
  CreditLine: 'מסגרת אשראי',
  DebitDate: 'תאריך חיוב אשראי',
  HOC: 'הוראות קבע',
};

export interface TransactionDetailsAction {
  creditLimit?: number;
  openToBuy?: number;
  isDiscontCard?: boolean;
  actionId: string;
  actionLinkTitle: string;
  actionTitle: string;
  actionSubTitle: string;
  actionText: string;
  needToShowButton: boolean;
  billingCycle?: number;
  possibleBillingCycles?: number[];
  hokItems?: HokItem[];
}

export interface HokItem {
  merchantName: string;
  amount: number;
}

interface ScrapedDetailsResult {
  result: {
    transactionDetailsActions: TransactionDetailsAction[];
  };
}

export interface ScrapedHomeDataResult {
  Result: HomeDataUserCardsResult;
}

export interface HomeDataUserCardsResult {
  UserCards: UserCards;
}

export interface UserCards {
  Summary: Summary[];
  Cards: Card[];
  IsMultUsers: boolean;
  IsMultAccounts: boolean;
}

export interface Summary {
  Currency: number;
  ActualDebitSum: number;
  TotalDebitSum: number;
  CurrencySymbol: string;
}

export interface Card {
  CatalogId: string;
  Last4Digits: string;
  ExpirationDate: string;
  OwnerFullName: string;
  CardName: string;
  CardImage: string;
  CreditLimit: number;
  OpenToBuy: number;
  FixedDebit: number;
  CycleSummaryInfo: any;
  ReturnCode: number;
  CardLogo: number;
  Index: number;
  CreditLimitType: number;
  IsActiveDigitalCard: boolean;
  IsOwnerDigitalCard: boolean;
  IsViewCardDetailsOK: boolean;
  ShowMonthlyBillingLayout: boolean;
  IsControlsBiZCardSubscribe: boolean;
  ClearingAmtForOtb: any;
  IsMyMAX: boolean;
  MyMaxHebrewName: string;
}

async function fetchTransactionsForMonth(page: Page, monthMoment: Moment) {
  const url = getTransactionsUrl(monthMoment);

  const data = await fetchGetWithinPage<ScrapedTransactionsResult>(page, url);
  const transactionsByAccount: Record<string, Transaction[]> = {};

  if (!data || !data.result) return transactionsByAccount;

  data.result.transactions
    // Filter out non-transactions without a plan type, e.g. summary rows
    .filter((transaction) => !!transaction.planName)
    .forEach((transaction: ScrapedTransaction) => {
      if (!transactionsByAccount[transaction.shortCardNumber]) {
        transactionsByAccount[transaction.shortCardNumber] = [];
      }

      const mappedTransaction = mapTransaction(transaction);
      transactionsByAccount[transaction.shortCardNumber].push(mappedTransaction);
    });

  return transactionsByAccount;
}

function addResult(allResults: Record<string, Transaction[]>, result: Record<string, Transaction[]>) {
  const clonedResults: Record<string, Transaction[]> = { ...allResults };
  Object.keys(result).forEach((accountNumber) => {
    if (!clonedResults[accountNumber]) {
      clonedResults[accountNumber] = [];
    }
    clonedResults[accountNumber].push(...result[accountNumber]);
  });
  return clonedResults;
}

function prepareTransactions(txns: Transaction[], startMoment: moment.Moment, combineInstallments: boolean, enableTransactionsFilterByDate: boolean) {
  let clonedTxns = Array.from(txns);
  if (!combineInstallments) {
    clonedTxns = fixInstallments(clonedTxns);
  }
  clonedTxns = sortTransactionsByDate(clonedTxns);
  clonedTxns = enableTransactionsFilterByDate ?
    filterOldTransactions(clonedTxns, startMoment, combineInstallments || false) :
    clonedTxns;
  return clonedTxns;
}

async function fetchTransactions(page: Page, options: ScraperOptions) {
  const futureMonthsToScrape = options.futureMonthsToScrape ?? 1;
  const defaultStartMoment = moment().subtract(1, 'years');
  const startMomentLimit = moment().subtract(4, 'years');
  const startDate = options.startDate || defaultStartMoment.toDate();
  const startMoment = moment.max(startMomentLimit, moment(startDate));
  const allMonths = getAllMonthMoments(startMoment, futureMonthsToScrape);

  await loadCategories(page);

  let allResults: Record<string, Transaction[]> = {};
  for (let i = 0; i < allMonths.length; i += 1) {
    const result = await fetchTransactionsForMonth(page, allMonths[i]);
    allResults = addResult(allResults, result);
  }

  Object.keys(allResults).forEach((accountNumber) => {
    let txns = allResults[accountNumber];
    txns = prepareTransactions(txns, startMoment, options.combineInstallments || false,
      (options.outputData?.enableTransactionsFilterByDate ?? true));
    allResults[accountNumber] = txns;
  });

  return allResults;
}

function getPossibleLoginResults(page: Page): PossibleLoginResults {
  const urls: PossibleLoginResults = {};
  urls[LoginResults.Success] = [SUCCESS_URL];
  urls[LoginResults.ChangePassword] = [PASSWORD_EXPIRED_URL];
  urls[LoginResults.InvalidPassword] = [async () => {
    return elementPresentOnPage(page, INVALID_DETAILS_SELECTOR);
  }];
  urls[LoginResults.UnknownError] = [async () => {
    return elementPresentOnPage(page, LOGIN_ERROR_SELECTOR);
  }];
  return urls;
}

function createLoginFields(credentials: ScraperSpecificCredentials) {
  return [
    { selector: '#user-name', value: credentials.username },
    { selector: '#password', value: credentials.password },
  ];
}

type ScraperSpecificCredentials = { username: string, password: string };

function transactionDetailsActionsURL() {
  return buildUrl(BASE_API_ACTIONS_URL, {
    path: '/api/registered/GetTransactionDetailsActions',
  });
}
function homePageDataURL() {
  return buildUrl(BASE_API_ACTIONS_URL, {
    path: '/api/registered/getHomePageData',
  });
}

async function getHomeCreditCards(page: Page): Promise<Card[]> {
  const url = homePageDataURL();

  const data = await fetchGetWithinPage<ScrapedHomeDataResult>(page, url);
  if (!data || !data.Result) {
    throw new Error('Failed to fetch home page data');
  }

  return data.Result.UserCards.Cards;
}

async function getTransactionDetailsActions(page: Page): Promise<TransactionDetailsAction[]> {
  const url = transactionDetailsActionsURL();

  const data = await fetchPostWithinPage<ScrapedDetailsResult>(page, url, {});
  if (!data || !data.result) {
    throw new Error('Failed to fetch transaction details actions');
  }

  return data.result.transactionDetailsActions;
}

class MaxScraper extends BaseScraperWithBrowser<ScraperSpecificCredentials> {
  getLoginOptions(credentials: ScraperSpecificCredentials): LoginOptions {
    return {
      loginUrl: LOGIN_URL,
      fields: createLoginFields(credentials),
      submitButtonSelector: 'app-user-login-form .general-button.send-me-code',
      preAction: async () => {
        if (await elementPresentOnPage(this.page, '#closePopup')) {
          await clickButton(this.page, '#closePopup');
        }
        await clickButton(this.page, '.personal-area > a.go-to-personal-area');
        await waitUntilElementFound(this.page, '#login-password-link', true);
        await clickButton(this.page, '#login-password-link');
        await waitUntilElementFound(this.page, '#login-password.tab-pane.active app-user-login-form', true);
      },
      checkReadiness: async () => {
        await waitUntilElementFound(this.page, '.personal-area > a.go-to-personal-area', true);
      },
      postAction: async () => redirectOrDialog(this.page),
      possibleResults: getPossibleLoginResults(this.page),
      waitUntil: 'domcontentloaded',
    };
  }

  async fetchData() {
    const results = await fetchTransactions(this.page, this.options);
    const allTransactions: Transaction[] = [];
    const data = await getTransactionDetailsActions(this.page);
    const cardsFrameworkObj = data.find((obj) => obj.actionTitle === ActionsTitle.CreditLine);
    const cards = await getHomeCreditCards(this.page);

    const creditCards: CardBlockType[] = Object.entries(results).map(([cardNumber, transactions]) => {
      const card = cards.find((c) => c.Last4Digits === cardNumber);
      const txns = transactions.map((t) => ({
        ...t,
        cardNumber,
      }));
      txns.forEach((t) => {
        allTransactions.push(t);
      });
      const cardFrameworkUsed = ((card?.CreditLimit || 0) - (card?.OpenToBuy || 0)) || 0;
      return {
        cardNumber,
        cardFramework: card?.CreditLimit,
        cardFrameworkUsed,
        cardFrameworkNotUsed: card?.OpenToBuy,
        cardImage: card?.CardImage,
        cardName: card?.CardName,
        cardUniqueId: card?.CatalogId,
        txns,
      };
    });

    const accounts: TransactionsAccount[] = [{
      cardsPastOrFutureDebit: {
        cardsBlock: creditCards,
        accountCreditFramework: cardsFrameworkObj?.creditLimit,
        accountFrameworkNotUsed: cardsFrameworkObj?.openToBuy,
      },
    }];

    return {
      success: true,
      accounts,
    };
  }
}

export default MaxScraper;

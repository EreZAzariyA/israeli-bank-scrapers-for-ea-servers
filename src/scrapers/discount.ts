import _ from 'lodash';
import moment from 'moment';
import { type Page } from 'puppeteer';
import { waitUntilElementFound } from '../helpers/elements-interactions';
import { fetchGetWithinPage } from '../helpers/fetch';
import { waitForNavigation } from '../helpers/navigation';
import {
  convertCreditCardsDebits,
  convertFutureDebits,
  convertLoans,
  convertTransactions,
  DATE_FORMAT,
} from '../utils';
import type {
  AccountInfoAndBalanceResultType,
  AccountInfoType,
  CardsPastOrFutureDebitResultType,
  FutureDebitsResultType,
  LoansResultType,
  MainLoansType,
  SavingResultType,
  ScrapedAccountData,
  ScrapedTransactionData,
  TransactionsAccount,
} from '../transactions';
import { TransactionStatuses } from '../transactions';
import { ScraperErrorTypes, ScraperErrorMessages } from './errors';
import { type ScraperOptions, type ScraperScrapingResult } from './interface';
import { BaseScraperWithBrowser, LoginResults, type PossibleLoginResults } from './base-scraper-with-browser';

const BASE_URL = 'https://start.telebank.co.il';

async function fetchAccountData(page: Page, options: ScraperOptions): Promise<ScraperScrapingResult> {
  const apiSiteUrl = `${BASE_URL}/Titan/gatewayAPI`;
  const accountDataUrl = `${apiSiteUrl}/userAccountsData`;
  const errors = [];

  const accountInfo = await fetchGetWithinPage<ScrapedAccountData>(page, accountDataUrl);
  if (!accountInfo) {
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: ScraperErrorMessages.FETCH_ACCOUNT_INFO_ERROR,
    };
  }
  const accountNumber = accountInfo.UserAccountsData.DefaultAccountNumber;

  const defaultStartMoment = moment().subtract(1, 'years').add(2, 'day');
  const startDate = options.startDate || defaultStartMoment.toDate();
  const startMoment = moment.max(defaultStartMoment, moment(startDate));
  const startDateStr = startMoment.format(DATE_FORMAT);

  const txnsUrl = `${apiSiteUrl}/lastTransactions/${accountNumber}/Date?IsCategoryDescCode=True&IsTransactionDetails=True&IsEventNames=True&IsFutureTransactionFlag=True&FromDate=${startDateStr}`;
  const txnsResult = await fetchGetWithinPage<ScrapedTransactionData>(page, txnsUrl);
  if (!txnsResult || txnsResult.Error || !txnsResult.CurrentAccountLastTransactions) {
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: ScraperErrorMessages.FETCH_TNXS_ERROR,
    };
  }
  const balance = txnsResult.CurrentAccountLastTransactions.CurrentAccountInfo.AccountBalance;
  const rawFutureTxns = _.get(txnsResult, 'CurrentAccountLastTransactions.FutureTransactionsBlock.FutureTransactionEntry');
  const completedTxns = convertTransactions(
    txnsResult.CurrentAccountLastTransactions.OperationEntry,
    TransactionStatuses.Completed,
  );
  const pendingTxns = convertTransactions(rawFutureTxns || [], TransactionStatuses.Pending);
  const transactions = [...completedTxns, ...pendingTxns];

  const infoAndBalanceUrl = `${apiSiteUrl}/accountDetails/infoAndBalance`;
  const extraInfoUrl = `${infoAndBalanceUrl}/${accountNumber}`;
  const extraInfoResult = await fetchGetWithinPage<AccountInfoAndBalanceResultType>(page, extraInfoUrl);
  if (!extraInfoResult || extraInfoResult.Error) {
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: ScraperErrorMessages.FETCH_ACCOUNT_EXTRA_INFO_ERROR,
    };
  }
  const extraInfo: AccountInfoType = {
    accountAvailableBalance: extraInfoResult.AccountInfoAndBalance.AccountAvailableBalance,
    accountBalance: extraInfoResult.AccountInfoAndBalance.AccountBalance,
    accountCurrencyCode: extraInfoResult.AccountInfoAndBalance.AccountCurrencyCode,
    accountCurrencyLongName: extraInfoResult.AccountInfoAndBalance.AccountCurrencyLongName,
    accountName: extraInfoResult.AccountInfoAndBalance.AccountName,
    accountStatusCode: extraInfoResult.AccountInfoAndBalance.AccountStatusCode,
    handlingBranchID: extraInfoResult.AccountInfoAndBalance.HandlingBranchID,
    handlingBranchName: extraInfoResult.AccountInfoAndBalance.HandlingBranchName,
    privateBusinessFlag: extraInfoResult.AccountInfoAndBalance.PrivateBusinessFlag,
  };

  const { AccountStatusCode, PrivateBusinessFlag } = extraInfoResult.AccountInfoAndBalance;
  const pastOrFutureDebitsUrl = `${apiSiteUrl}/creditCards/pastOrFutureDebits/${accountNumber}/${AccountStatusCode}/${PrivateBusinessFlag}`;
  const pastOrFutureDebitsResult = await fetchGetWithinPage<FutureDebitsResultType>(page, pastOrFutureDebitsUrl);
  if (!pastOrFutureDebitsResult || pastOrFutureDebitsResult.Error) {
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: ScraperErrorMessages.FETCH_DEBITS_ERROR,
    };
  }
  const pastOrFutureDebits = convertFutureDebits(pastOrFutureDebitsResult);

  const cardsDebitsUrl = `${apiSiteUrl}/creditCards/cardsPastOrFutureDebitTotal`;
  const cardsDebitsFullUrl = `${cardsDebitsUrl}/${accountNumber}/F`;
  const cardsDebitsResult = await fetchGetWithinPage<CardsPastOrFutureDebitResultType>(page, cardsDebitsFullUrl);
  if (!cardsDebitsResult || cardsDebitsResult.Error) {
    return {
      success: false,
      errorType: ScraperErrorTypes.Generic,
      errorMessage: ScraperErrorMessages.FETCH_CARD_DEBITS_ERROR,
    };
  }
  const cardsPastOrFutureDebit = convertCreditCardsDebits(cardsDebitsResult);

  const savingUrl = `${apiSiteUrl}/deposits/depositsDetails`;
  const savingFullUrl = `${savingUrl}/${accountNumber}/1`;
  const savingResult = await fetchGetWithinPage<SavingResultType>(page, savingFullUrl);
  if (!savingResult || savingResult.Error) {
    errors.push(ScraperErrorMessages.FETCH_ACCOUNT_SAVES_ERROR);
  }

  const loansUrl = `${apiSiteUrl}/onlineLoans/loansQuery/${accountNumber}`;
  const loansResult = await fetchGetWithinPage<LoansResultType>(page, loansUrl);

  let loans: MainLoansType | undefined;
  if (!loansResult || loansResult.Error) {
    errors.push(ScraperErrorMessages.FETCH_LOANS_ERROR);
  } else {
    loans = convertLoans(loansResult);
  }

  const account: TransactionsAccount = {
    accountNumber,
    balance,
    txns: transactions,
    info: extraInfo,
    pastOrFutureDebits,
    cardsPastOrFutureDebit,
    saving: {
      businessDate: savingResult?.DepositsDetails?.BusinessDate,
      currencyCode: savingResult?.DepositsDetails?.CurrencyCode,
      totalDepositsCurrentValue: savingResult?.DepositsDetails?.TotalDepositsCurrentValue,
    },
    loans,
  };

  return {
    success: true,
    accounts: [account],
  };
}

async function navigateOrErrorLabel(page: Page) {
  try {
    await waitForNavigation(page);
  } catch (e) {
    await waitUntilElementFound(page, '#general-error', false, 100);
  }
}

function getPossibleLoginResults(): PossibleLoginResults {
  const urls: PossibleLoginResults = {};
  urls[LoginResults.Success] = [`${BASE_URL}/apollo/retail/#/MY_ACCOUNT_HOMEPAGE`];
  urls[LoginResults.InvalidPassword] = [`${BASE_URL}/apollo/core/templates/lobby/masterPage.html#/LOGIN_PAGE`];
  urls[LoginResults.ChangePassword] = [`${BASE_URL}/apollo/core/templates/lobby/masterPage.html#/PWD_RENEW`];
  return urls;
}

function createLoginFields(credentials: ScraperSpecificCredentials) {
  return [
    { selector: '#tzId', value: credentials.id },
    { selector: '#tzPassword', value: credentials.password },
    { selector: '#aidnum', value: credentials.num },
  ];
}

type ScraperSpecificCredentials = { id: string, password: string, num: string };

class DiscountScraper extends BaseScraperWithBrowser<ScraperSpecificCredentials> {
  getLoginOptions(credentials: ScraperSpecificCredentials) {
    return {
      loginUrl: `${BASE_URL}/login/#/LOGIN_PAGE`,
      checkReadiness: async () => waitUntilElementFound(this.page, '#tzId'),
      fields: createLoginFields(credentials),
      submitButtonSelector: '.sendBtn',
      postAction: async () => navigateOrErrorLabel(this.page),
      possibleResults: getPossibleLoginResults(),
    };
  }

  async fetchData() {
    return fetchAccountData(this.page, this.options);
  }
}

export default DiscountScraper;

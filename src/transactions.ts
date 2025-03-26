export interface TransactionsAccount {
  accountNumber?: string;
  balance?: number;
  txns?: Transaction[];
  info?: AccountInfoType;
  pastOrFutureDebits?: PastOrFutureDebitType[];
  cardsPastOrFutureDebit?: Partial<CardsPastOrFutureDebitType>;
  saving?: AccountSavesType;
  loans?: MainLoansType;
  securities?: SecuritiesType;
}

export enum TransactionTypes {
  Normal = 'normal',
  Installments = 'installments',
}

export enum TransactionStatuses {
  Completed = 'completed',
  Pending = 'pending',
}

export interface TransactionInstallments {
  /**
   * the current installment number
   */
  number: number;

  /**
   * the total number of installments
   */
  total: number;
}

export interface Transaction {
  type: TransactionTypes;
  /**
   * sometimes called Asmachta
   */
  identifier?: string | number;
  /**
   * ISO date string
   */
  date: string;
  /**
   * ISO date string
   */
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string;
  description: string;
  memo?: string;
  status: TransactionStatuses;
  installments?: TransactionInstallments;
  category?: string;
  categoryDescription?: string;
  channel?: string;
  channelName?: string;
  cardNumber?: string | number;
}

export interface MainLoansType {
  loans: LoanType[];
  summary: {
    currentMonthTotalPayment: number;
    totalBalance: number;
    totalBalanceCurrency: string;
  };
  currentTimestamp: number;
}

export type LoanType = {
  loanAccount: string;
  loanName: string;
  numOfPayments: string;
  numOfPaymentsRemained: string;
  numOfPaymentsMade: string;
  establishmentDate: string;
  establishmentChannelCode: string;
  loanCurrency: string;
  loanAmount: number;
  totalInterestRate: number;
  firstPaymentDate: string;
  lastPaymentDate: string;
  nextPaymentDate: string;
  previousPaymentDate: string;
  nextPayment: number;
  previousPayment: number;
  baseInterestDescription: string;
  loanBalance: number;
  prepaymentPenaltyFee: number;
  totalLoanBalance: number;
  finishDate: string;
  loanRefundStatus: string;
  establishmentValueDate: string;
  currentMonthPayment: number;
  numberOfPartialPrepayments: string;
  loanPurpose: string;
};

export interface AccountInfoType {
  accountName?: string;
  accountAvailableBalance?: number;
  accountBalance?: number;
  accountStatusCode?: string;
  accountCurrencyCode?: string;
  accountCurrencyLongName?: string;
  handlingBranchID?: string;
  handlingBranchName?: string;
  privateBusinessFlag?: string;
}
export interface PastOrFutureDebitType {
  debitMonth: string | number;
  monthlyNumberOfTransactions: number;
  monthlyNISDebitSum: number;
  monthlyUSDDebitSum: number;
  monthlyEURDebitSum: number;
}
export type CardBlockType = {
  cardUniqueId?: string;
  last4Digits?: string;
  txns?: Transaction[];
  firstName?: string;
  lastName?: string;
  cardName?: string;
  cardNumber: string;
  cardFramework?: number;
  cardFrameworkNotUsed?: number;
  cardFrameworkUsed?: number;
  cardTypeDescription?: string;
  cardFamilyDescription?: string;
  cardStatusCode?: number;
  cardValidityDate?: string;
  cardImage?: string;
  dateOfUpcomingDebit?: string;
  NISTotalDebit?: number;
  USDTotalDebit?: number;
  EURTotalDebit?: number;
};

export interface CardsPastOrFutureDebitType {
  cardsBlock: CardBlockType[];
  accountCreditFramework: number;
  accountFrameworkNotUsed: number;
  accountFrameworkUsed: number;
}
export interface AccountSavesType {
  businessDate?: string;
  totalDepositsCurrentValue?: number;
  currencyCode?: string;
}

export type CreditCardProvidersType = {
  cardUniqueId?: string;
  cardNumber: string;
  txns: Transaction[];
};

export interface SecuritiesType {
  CurrentSecuritiesPortfolio?: CurrentSecuritiesPortfolio;
  Error?: { MsgText: string };
}
export interface CurrentSecuritiesPortfolio {
  BeginYearReturn: number;
  BeginYearReturnFlag: number;
  BeginYearReturnExceptionalFlag: number;
  TransactionTime: string;
  PortfolioValue: number;
  Collaterals: number;
  TotalPayFlag: string;
  TotalPayAmount: number;
  LendingFlag: string;
  DailyPortfolioLossOrProfitDataFlag: string;
  DailyPortfolioLossOrProfitChangePercent: number;
  DailyPortfolioLossOrProfitAmount: number;
  BusinessDateFlag: string;
  ForeignTradeDateFlag: string;
  CryptoTotalValue: number;
  CryptoTotalPercentFromPortfolio: number;
}

export interface LoansResultType {
  LoansQuery: LoansQuery;
  Error?: string;
}
export interface LoansQuery {
  LoanDetailsBlock: LoanDetailsBlock;
  Summary: Summary;
  CurrentTimestamp: number;
}
export interface LoanDetailsBlock {
  LoanEntry: LoanEntry[];
}
export interface LoanEntry {
  LoanAccount: string;
  LoanName: string;
  NumOfPayments: string;
  NumOfPaymentsRemained: string;
  NumOfPaymentsMade: string;
  EstablishmentDate: string;
  EstablishmentChannelCode: string;
  LoanCurrency: string;
  LoanAmount: number;
  TotalInterestRate: number;
  FirstPaymentDate: string;
  LastPaymentDate: string;
  NextPaymentDate: string;
  PreviousPaymentDate: string;
  NextPayment: number;
  PreviousPayment: number;
  BaseInterestDescription: string;
  LoanBalance: number;
  PrepaymentPenaltyFee: number;
  TotalLoanBalance: number;
  FinishDate: string;
  LoanRefundStatus: string;
  EstablishmentValueDate: string;
  CurrentMonthPayment: number;
  NumberOfPartialPrepayments: string;
  LoanPurpose: string;
}
export interface Summary {
  CurrentMonthTotalPayment: number;
  TotalBalance: number;
  TotalBalanceCurrency: string;
}

export interface ScrapedTransaction {
  OperationNumber: number;
  OperationDate: string;
  ValueDate: string;
  OperationAmount: number;
  OperationDescriptionToDisplay: string;
  CategoryDescription?: string;
  Channel?: string;
  ChannelName?: string;
}

export interface CurrentAccountInfo {
  AccountBalance: number;
}

export type CardBlockResultType = {
  CardHolderFirstName: string;
  CardHolderLastName: string;
  CardName: string;
  CardNumber: string;
  CardFramework: number;
  CardFrameworkNotUsed: number;
  CardFrameworkUsed: number;
  CardTypeDescription: string;
  CardFamilyDescription: string;
  CardStatusCode: number;
  CardValidityDate: string;
  DateOfUpcomingDebit: string;
  NISTotalDebit: number;
  USDTotalDebit: number;
  EURTotalDebit: number;
};

export interface CardsPastOrFutureDebitResultType {
  CardsPastOrFutureDebitTotal: {
    AccountCreditFramework: number;
    AccountFrameworkNotUsed: number;
    AccountFrameworkUsed: number;
    CardsBlock: {
      CardsEntry: CardBlockResultType[];
    };
  };
  Error?: { MsgText: string };
}

export interface PastOrFutureDebitsTypeResult {
  DebitMonth: string;
  MonthlyNumberOfTransactions: number;
  MonthlyNISDebitSum: number;
  MonthlyUSDDebitSum: number;
  MonthlyEURDebitSum: number;
}

export interface AccountInfoAndBalanceResultType {
  AccountInfoAndBalance: AccountInfoResultType;
  Error?: { MsgText: string };
}

export interface SavingResultType {
  DepositsDetails: {
    BusinessDate: string;
    TotalDepositsCurrentValue: number;
    CurrencyCode: string;
  };
  Error: { MsgText: string };
}

export interface AccountInfoResultType {
  AccountName: string;
  HandlingBranchID: string;
  HandlingBranchName: string;
  AccountBalance: number;
  AccountAvailableBalance: number;
  AccountStatusCode: string;
  AccountCurrencyCode: string;
  AccountCurrencyLongName: string;
  PrivateBusinessFlag: string;
}

export interface FutureDebitsResultType {
  PastOrFutureDebits: {
    DebitsAndTotalsEntryBlock: {
      DebitsAndTotalsEntry: PastOrFutureDebitsTypeResult[];
    };
  };
  Error: { MsgText: string };
}

export interface ScrapedAccountData {
  UserAccountsData: {
    DefaultAccountNumber: string;
  };
}

export interface ScrapedTransactionData {
  Error?: { MsgText: string };
  CurrentAccountLastTransactions?: {
    OperationEntry: ScrapedTransaction[];
    CurrentAccountInfo: CurrentAccountInfo;
  };
}

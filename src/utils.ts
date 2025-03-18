import moment from 'moment';
import {
  type TransactionStatuses, type Transaction, TransactionTypes,
  type ScrapedTransaction,
  type LoansResultType,
  type MainLoansType,
  type CardBlockType,
  type CardsPastOrFutureDebitResultType,
  type CardsPastOrFutureDebitType,
  type FutureDebitsResultType,
  type LoanType,
  type PastOrFutureDebitType,
} from './transactions';

export const DATE_FORMAT = 'YYYYMMDD';

export const convertTransactions = (txns: ScrapedTransaction[], txnStatus: TransactionStatuses): Transaction[] => {
  if (!txns) {
    return [];
  }
  return txns.map((txn) => {
    return {
      type: TransactionTypes.Normal,
      identifier: txn.OperationNumber,
      date: moment(txn.OperationDate, DATE_FORMAT).toISOString(),
      processedDate: moment(txn.ValueDate, DATE_FORMAT).toISOString(),
      originalAmount: txn.OperationAmount,
      originalCurrency: 'ILS',
      chargedAmount: txn.OperationAmount,
      description: txn.OperationDescriptionToDisplay,
      status: txnStatus,
      categoryDescription: txn?.CategoryDescription,
      channel: txn?.Channel,
      channelName: txn?.ChannelName,
    };
  });
};

export const convertLoans = (loansResult: LoansResultType): MainLoansType | undefined => {
  if (!loansResult.LoansQuery) {
    return undefined;
  }

  const loans: LoanType[] = loansResult.LoansQuery.LoanDetailsBlock.LoanEntry.map((loan) => ({
    loanAccount: loan.LoanAccount,
    loanName: loan.LoanName,
    numOfPayments: loan.NumOfPayments,
    numOfPaymentsRemained: loan.NumOfPaymentsRemained,
    numOfPaymentsMade: loan.NumOfPaymentsMade,
    establishmentDate: loan.EstablishmentDate,
    establishmentChannelCode: loan.EstablishmentChannelCode,
    loanCurrency: loan.LoanCurrency,
    loanAmount: loan.LoanAmount,
    totalInterestRate: loan.TotalInterestRate,
    firstPaymentDate: loan.FirstPaymentDate,
    lastPaymentDate: loan.LastPaymentDate,
    nextPayment: loan.NextPayment,
    nextPaymentDate: loan.NextPaymentDate,
    previousPayment: loan.PreviousPayment,
    previousPaymentDate: loan.PreviousPaymentDate,
    baseInterestDescription: loan.BaseInterestDescription,
    loanBalance: loan.LoanBalance,
    prepaymentPenaltyFee: loan.PrepaymentPenaltyFee,
    totalLoanBalance: loan.TotalLoanBalance,
    finishDate: loan.FinishDate,
    loanRefundStatus: loan.LoanRefundStatus,
    establishmentValueDate: loan.EstablishmentValueDate,
    currentMonthPayment: loan.CurrentMonthPayment,
    numberOfPartialPrepayments: loan.NumberOfPartialPrepayments,
    loanPurpose: loan.LoanPurpose,
  }));

  return {
    summary: {
      currentMonthTotalPayment: loansResult.LoansQuery.Summary.CurrentMonthTotalPayment,
      totalBalance: loansResult.LoansQuery.Summary.TotalBalance,
      totalBalanceCurrency: loansResult.LoansQuery.Summary.TotalBalanceCurrency,
    },
    currentTimestamp: loansResult.LoansQuery.CurrentTimestamp,
    loans,
  };
};

export const convertFutureDebits = (
  pastOrFutureDebitsResult: FutureDebitsResultType,
): PastOrFutureDebitType[] => {
  if (!pastOrFutureDebitsResult.PastOrFutureDebits) {
    return [];
  }

  return pastOrFutureDebitsResult.PastOrFutureDebits.DebitsAndTotalsEntryBlock
    .DebitsAndTotalsEntry
    .map((d) => ({
      debitMonth: d.DebitMonth,
      monthlyNumberOfTransactions: d.MonthlyNumberOfTransactions,
      monthlyNISDebitSum: d.MonthlyNISDebitSum,
      monthlyUSDDebitSum: d.MonthlyUSDDebitSum,
      monthlyEURDebitSum: d.MonthlyEURDebitSum,
    }));
};

export const convertCreditCardsDebits = (
  cardsDebitsResult: CardsPastOrFutureDebitResultType,
): CardsPastOrFutureDebitType | undefined => {
  if (!cardsDebitsResult.CardsPastOrFutureDebitTotal) {
    return undefined;
  }

  const cardsBlock: CardBlockType[] = cardsDebitsResult.CardsPastOrFutureDebitTotal.CardsBlock.CardsEntry
    .map((card) => ({
      cardFamilyDescription: card.CardFamilyDescription,
      cardFramework: card.CardFramework,
      cardFrameworkNotUsed: card.CardFrameworkNotUsed,
      cardFrameworkUsed: card.CardFrameworkUsed,
      firstName: card.CardHolderFirstName,
      lastName: card.CardHolderLastName,
      cardName: card.CardName,
      cardNumber: card.CardNumber,
      cardTypeDescription: card.CardTypeDescription,
      cardStatusCode: card.CardStatusCode,
      cardValidityDate: card.CardValidityDate,
      dateOfUpcomingDebit: card.DateOfUpcomingDebit,
      NISTotalDebit: card.NISTotalDebit,
      USDTotalDebit: card.USDTotalDebit,
      EURTotalDebit: card.EURTotalDebit,
    }));

  return {
    accountFrameworkUsed: cardsDebitsResult.CardsPastOrFutureDebitTotal.AccountFrameworkUsed,
    accountCreditFramework: cardsDebitsResult.CardsPastOrFutureDebitTotal.AccountCreditFramework,
    accountFrameworkNotUsed: cardsDebitsResult.CardsPastOrFutureDebitTotal.AccountFrameworkNotUsed,
    cardsBlock,
  };
};

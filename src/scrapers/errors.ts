export enum ScraperErrorTypes {
  TwoFactorRetrieverMissing = 'TWO_FACTOR_RETRIEVER_MISSING',
  InvalidPassword = 'INVALID_PASSWORD',
  ChangePassword = 'CHANGE_PASSWORD',
  Timeout = 'TIMEOUT',
  AccountBlocked = 'ACCOUNT_BLOCKED',
  Generic = 'GENERIC',
  General = 'GENERAL_ERROR',
}

export enum ScraperErrorMessages {
  FETCH_TNXS_ERROR = 'Failed to fetch account transactions.',
  FETCH_ACCOUNT_INFO_ERROR = 'Failed to fetch account info.',
  FETCH_ACCOUNT_EXTRA_INFO_ERROR = 'Failed to fetch account extra info.',
  FETCH_DEBITS_ERROR = 'Failed to fetch past or future debits.',
  FETCH_CARD_DEBITS_ERROR = 'Failed to fetch cards debits.',
  FETCH_ACCOUNT_SAVES_ERROR = 'Failed to fetch account saves.',
  FETCH_ACCOUNT_SECURITIES_ERROR = 'Failed to fetch account securities.',
  FETCH_LOANS_ERROR = 'Failed to fetch account loans.',
}

export type ErrorResult = {
  success: false;
  errorType: ScraperErrorTypes;
  errorMessage: string;
};

function createErrorResult(errorType: ScraperErrorTypes, errorMessage: string): ErrorResult {
  return {
    success: false,
    errorType,
    errorMessage,
  };
}

export function createTimeoutError(errorMessage: string): ErrorResult {
  return createErrorResult(ScraperErrorTypes.Timeout, errorMessage);
}

export function createGenericError(errorMessage: string): ErrorResult {
  return createErrorResult(ScraperErrorTypes.Generic, errorMessage);
}

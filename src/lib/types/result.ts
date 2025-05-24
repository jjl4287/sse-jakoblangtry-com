export type Result<T, E = Error> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
}

export interface Failure<E> {
  success: false;
  error: E;
}

export const Result = {
  success: <T>(data: T): Success<T> => ({ success: true, data }),
  
  failure: <E>(error: E): Failure<E> => ({ success: false, error }),
  
  from: <T>(fn: () => T): Result<T, Error> => {
    try {
      return Result.success(fn());
    } catch (error) {
      return Result.failure(error instanceof Error ? error : new Error(String(error)));
    }
  },
  
  fromAsync: async <T>(fn: () => Promise<T>): Promise<Result<T, Error>> => {
    try {
      const data = await fn();
      return Result.success(data);
    } catch (error) {
      return Result.failure(error instanceof Error ? error : new Error(String(error)));
    }
  },
  
  map: <T, U>(result: Result<T>, fn: (data: T) => U): Result<U> => {
    if (result.success) {
      return Result.success(fn(result.data));
    }
    return result;
  },
  
  flatMap: <T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> => {
    if (result.success) {
      return fn(result.data);
    }
    return result;
  },
  
  mapError: <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> => {
    if (!result.success) {
      return Result.failure(fn(result.error));
    }
    return result;
  },
  
  isSuccess: <T, E>(result: Result<T, E>): result is Success<T> => result.success,
  
  isFailure: <T, E>(result: Result<T, E>): result is Failure<E> => !result.success,
  
  unwrap: <T>(result: Result<T>): T => {
    if (result.success) {
      return result.data;
    }
    throw result.error;
  },
  
  unwrapOr: <T>(result: Result<T>, defaultValue: T): T => {
    if (result.success) {
      return result.data;
    }
    return defaultValue;
  },
  
  unwrapOrElse: <T>(result: Result<T>, fn: () => T): T => {
    if (result.success) {
      return result.data;
    }
    return fn();
  },
};

export const Ok = Result.success;
export const Err = Result.failure; 
/**
 * Safely parses JSON data with error handling
 * @param jsonString The JSON string to parse
 * @param fallback Optional fallback value to return if parsing fails
 * @returns The parsed JSON object or fallback value
 */
export const safeJsonParse = <T>(jsonString: string, fallback?: T): T => {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
  }
};

/**
 * Safely converts an object to a JSON string with error handling
 * @param data The data to stringify
 * @returns The JSON string
 */
export const safeJsonStringify = (data: unknown): string => {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    throw new Error(`Failed to stringify JSON: ${(error as Error).message}`);
  }
};

/**
 * Handles Date objects correctly when parsing JSON
 * @param key The JSON key
 * @param value The JSON value
 * @returns The processed value with Date objects properly revived
 */
export const jsonDateReviver = (key: string, value: any): any => {
  // Check if the value looks like an ISO date string
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/.test(value)) {
    return new Date(value);
  }
  return value;
};

/**
 * Parses JSON with date reviving
 * @param jsonString The JSON string to parse
 * @returns The parsed object with Date objects properly handled
 */
export const parseJsonWithDates = <T>(jsonString: string): T => {
  return JSON.parse(jsonString, jsonDateReviver) as T;
};

/**
 * Serializes an object to JSON with proper Date handling
 * @param data The data to serialize
 * @returns The JSON string with dates converted to ISO strings
 */
export const stringifyWithDates = (data: unknown): string => {
  return JSON.stringify(data, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}; 
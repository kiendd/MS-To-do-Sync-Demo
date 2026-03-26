export interface GraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
  "@odata.context"?: string;
}

export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      "request-id"?: string;
      date?: string;
    };
  };
}

export interface GraphFetchAllResult<T> {
  value: T[];
  deltaLink?: string;
}

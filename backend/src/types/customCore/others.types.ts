
export type Query = {
  $text?: { $search: string };
  [key: string]: any;
};

export type Options = {
  search?: string;
  page?: number;
  limit?: number;
};

export type UpdateData = {
  username?: string;
  email?: string;
  password?: string;
  images?: string[]
};

export type ErrorHandlerResponse = { 
  type: string;
  message: string;
  code: number;
  context?: Record<string, any>;
  stack?: string }
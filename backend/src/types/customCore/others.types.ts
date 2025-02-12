type Query = {
  $text?: { $search: string };
  [key: string]: any;
};

type Options = {
  search?: string;
  page?: number;
  limit?: number;
};

type UpdateData = {
  username?: string;
  email?: string;
  password?: string;

};

type ErrorHandlerResponse = { 
  type: string;
  message: string;
  code: number;
  context?: Record<string, any>;
  stack?: string }
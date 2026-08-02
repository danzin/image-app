import type { IUser, PaginationOptions, PaginationResult } from "@/types";

/**
 * Directory and user-search reads shared by user listing consumers.
 */
export interface UserDirectoryLookup {
  getAll(options: {
    search?: string[];
    page?: number;
    limit?: number;
  }): Promise<IUser[] | null>;
  findWithPagination(
    options: PaginationOptions,
  ): Promise<PaginationResult<IUser>>;
}

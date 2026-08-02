import type { UserLookupData } from "@/types";

export interface UserLookup {
  findMany(userPublicIds: readonly string[]): Promise<UserLookupData[]>;
}

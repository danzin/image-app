import "reflect-metadata";
import { expect } from "chai";
import { describe, it } from "mocha";
import sinon from "sinon";
import { CloudinaryService } from "@/services/cloudinary.service";
import { LocalStorageService } from "@/services/localStorage.service";
import { RetryService } from "@/services/retry.service";
import type { IImageStorageService } from "@/types";
import { asUserPublicId } from "@/types/branded";

const USER_PUBLIC_ID = asUserPublicId(
  "00000000-0000-4000-8000-000000000001",
);

const providers: ReadonlyArray<{
  name: string;
  create: () => IImageStorageService;
}> = [
  {
    name: "CloudinaryService",
    create: () =>
      new CloudinaryService(
        sinon.createStubInstance(RetryService) as unknown as RetryService,
      ),
  },
  {
    name: "LocalStorageService",
    create: () => new LocalStorageService(),
  },
];

describe("image storage deletion contract", () => {
  for (const provider of providers) {
    it(`${provider.name} skips missing and malformed asset URLs`, async () => {
      const storage = provider.create();

      expect(
        await storage.deleteAssetByUrl(
          USER_PUBLIC_ID,
          USER_PUBLIC_ID,
          "",
        ),
      ).to.deep.equal({ result: "skipped" });
      expect(
        await storage.deleteAssetByUrl(
          USER_PUBLIC_ID,
          USER_PUBLIC_ID,
          "https://example.com/uploads/user/%E0%A4%A",
        ),
      ).to.deep.equal({ result: "skipped" });
    });
  }
});

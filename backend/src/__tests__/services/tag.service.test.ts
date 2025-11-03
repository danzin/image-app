import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Types } from "mongoose";
import { TagService } from "../../services/tag.service";

chai.use(chaiAsPromised);

describe("TagService", () => {
	let tagService: TagService;
	let mockTagRepository: {
		findByNames: SinonStub;
		create: SinonStub;
		incrementUsage: SinonStub;
		decrementUsage: SinonStub;
	};
	let mockSession: ClientSession;

	beforeEach(() => {
		mockTagRepository = {
			findByNames: sinon.stub(),
			create: sinon.stub(),
			incrementUsage: sinon.stub(),
			decrementUsage: sinon.stub(),
		};

		mockSession = {} as ClientSession;

		tagService = new TagService(mockTagRepository as any);
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("ensureTagsExist", () => {
		it("should return existing tag IDs when all tags exist", async () => {
			const tagNames = ["nature", "landscape"];
			const existingTags = [
				{ _id: new Types.ObjectId(), tag: "nature", usageCount: 5 },
				{ _id: new Types.ObjectId(), tag: "landscape", usageCount: 3 },
			];

			mockTagRepository.findByNames.resolves(existingTags);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByNames.calledWith(tagNames, mockSession)).to.be.true;
			expect(result).to.have.lengthOf(2);
			expect(result[0].toString()).to.equal(existingTags[0]._id.toString());
			expect(result[1].toString()).to.equal(existingTags[1]._id.toString());
		});

		it("should create new tags when some tags do not exist", async () => {
			const tagNames = ["nature", "sunset", "beach"];
			const existingTags = [{ _id: new Types.ObjectId(), tag: "nature", usageCount: 5 }];
			const newTags = [
				{ _id: new Types.ObjectId(), tag: "sunset", usageCount: 1 },
				{ _id: new Types.ObjectId(), tag: "beach", usageCount: 1 },
			];

			mockTagRepository.findByNames.resolves(existingTags);
			mockTagRepository.create.resolves(newTags);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByNames.calledWith(tagNames, mockSession)).to.be.true;
			expect(mockTagRepository.create.calledOnce).to.be.true;
			expect(result).to.have.lengthOf(3);
		});

		it("should handle empty tag list", async () => {
			const result = await tagService.ensureTagsExist([], mockSession);

			expect(mockTagRepository.findByNames.called).to.be.false;
			expect(mockTagRepository.create.called).to.be.false;
			expect(result).to.be.an("array").that.is.empty;
		});

		it("should normalize tag names to lowercase", async () => {
			const tagNames = ["NaTuRe", "SUNSET"];
			const existingTags = [{ _id: new Types.ObjectId(), tag: "nature", usageCount: 5 }];
			const newTags = [{ _id: new Types.ObjectId(), tag: "sunset", usageCount: 1 }];

			mockTagRepository.findByNames.resolves(existingTags);
			mockTagRepository.create.resolves(newTags);

			await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByNames.calledWith(["nature", "sunset"], mockSession)).to.be.true;
		});

		it("should remove duplicate tags", async () => {
			const tagNames = ["nature", "nature", "sunset"];
			const existingTags = [
				{ _id: new Types.ObjectId(), tag: "nature", usageCount: 5 },
				{ _id: new Types.ObjectId(), tag: "sunset", usageCount: 2 },
			];

			mockTagRepository.findByNames.resolves(existingTags);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByNames.calledWith(["nature", "sunset"], mockSession)).to.be.true;
			expect(result).to.have.lengthOf(2);
		});
	});

	describe("incrementUsage", () => {
		it("should increment usage count for all provided tag IDs", async () => {
			const tagIds = [new Types.ObjectId(), new Types.ObjectId()];

			mockTagRepository.incrementUsage.resolves();

			await tagService.incrementUsage(tagIds, mockSession);

			expect(mockTagRepository.incrementUsage.calledWith(tagIds, mockSession)).to.be.true;
		});

		it("should handle empty tag ID list", async () => {
			await tagService.incrementUsage([], mockSession);

			expect(mockTagRepository.incrementUsage.called).to.be.false;
		});
	});

	describe("decrementUsage", () => {
		it("should decrement usage count for all provided tag IDs", async () => {
			const tagIds = [new Types.ObjectId(), new Types.ObjectId()];

			mockTagRepository.decrementUsage.resolves();

			await tagService.decrementUsage(tagIds, mockSession);

			expect(mockTagRepository.decrementUsage.calledWith(tagIds, mockSession)).to.be.true;
		});

		it("should handle empty tag ID list", async () => {
			await tagService.decrementUsage([], mockSession);

			expect(mockTagRepository.decrementUsage.called).to.be.false;
		});
	});
});

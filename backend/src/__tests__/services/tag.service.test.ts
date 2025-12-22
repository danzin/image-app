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
		findByTag: SinonStub;
		create: SinonStub;
		findOneAndUpdate: SinonStub;
	};
	let mockSession: ClientSession;

	beforeEach(() => {
		mockTagRepository = {
			findByTag: sinon.stub(),
			create: sinon.stub(),
			findOneAndUpdate: sinon.stub(),
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
				{ _id: new Types.ObjectId(), tag: "nature", count: 5 },
				{ _id: new Types.ObjectId(), tag: "landscape", count: 3 },
			];

			// findByTag is called for each tag
			mockTagRepository.findByTag.withArgs("nature", mockSession).resolves(existingTags[0]);
			mockTagRepository.findByTag.withArgs("landscape", mockSession).resolves(existingTags[1]);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByTag.calledTwice).to.be.true;
			expect(result).to.have.lengthOf(2);
			expect(result[0]._id.toString()).to.equal(existingTags[0]._id.toString());
			expect(result[1]._id.toString()).to.equal(existingTags[1]._id.toString());
		});

		it("should create new tags when some tags do not exist", async () => {
			const tagNames = ["nature", "sunset"];
			const existingTag = { _id: new Types.ObjectId(), tag: "nature", count: 5 };
			const newTag = { _id: new Types.ObjectId(), tag: "sunset", count: 0 };

			mockTagRepository.findByTag.withArgs("nature", mockSession).resolves(existingTag);
			mockTagRepository.findByTag.withArgs("sunset", mockSession).resolves(null);
			mockTagRepository.create.resolves(newTag);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			expect(mockTagRepository.findByTag.calledTwice).to.be.true;
			expect(mockTagRepository.create.calledOnce).to.be.true;
			expect(result).to.have.lengthOf(2);
		});

		it("should handle empty tag list", async () => {
			const result = await tagService.ensureTagsExist([], mockSession);

			expect(mockTagRepository.findByTag.called).to.be.false;
			expect(mockTagRepository.create.called).to.be.false;
			expect(result).to.be.an("array").that.is.empty;
		});

		it("should normalize tag names to lowercase", async () => {
			const tagNames = ["NaTuRe", "SUNSET"];
			const existingTag = { _id: new Types.ObjectId(), tag: "nature", count: 5 };
			const newTag = { _id: new Types.ObjectId(), tag: "sunset", count: 0 };

			mockTagRepository.findByTag.withArgs("nature", mockSession).resolves(existingTag);
			mockTagRepository.findByTag.withArgs("sunset", mockSession).resolves(null);
			mockTagRepository.create.resolves(newTag);

			await tagService.ensureTagsExist(tagNames, mockSession);

			// verify it was called with lowercase tags
			expect(mockTagRepository.findByTag.calledWith("nature", mockSession)).to.be.true;
			expect(mockTagRepository.findByTag.calledWith("sunset", mockSession)).to.be.true;
		});

		it("should remove duplicate tags", async () => {
			const tagNames = ["nature", "nature", "sunset"];
			const natureTag = { _id: new Types.ObjectId(), tag: "nature", count: 5 };
			const sunsetTag = { _id: new Types.ObjectId(), tag: "sunset", count: 2 };

			mockTagRepository.findByTag.withArgs("nature", mockSession).resolves(natureTag);
			mockTagRepository.findByTag.withArgs("sunset", mockSession).resolves(sunsetTag);

			const result = await tagService.ensureTagsExist(tagNames, mockSession);

			// should only call findByTag twice (deduplicated)
			expect(mockTagRepository.findByTag.calledTwice).to.be.true;
			expect(result).to.have.lengthOf(2);
		});
	});

	describe("incrementUsage", () => {
		it("should increment usage count for all provided tag IDs", async () => {
			const tagIds = [new Types.ObjectId(), new Types.ObjectId()];

			mockTagRepository.findOneAndUpdate.resolves({});

			await tagService.incrementUsage(tagIds, mockSession);

			expect(mockTagRepository.findOneAndUpdate.calledTwice).to.be.true;
			// verify the $inc: { count: 1 } is in the update
			const firstCall = mockTagRepository.findOneAndUpdate.firstCall;
			expect(firstCall.args[1]).to.deep.include({ $inc: { count: 1 } });
		});

		it("should handle empty tag ID list", async () => {
			await tagService.incrementUsage([], mockSession);

			expect(mockTagRepository.findOneAndUpdate.called).to.be.false;
		});
	});

	describe("decrementUsage", () => {
		it("should decrement usage count for all provided tag IDs", async () => {
			const tagIds = [new Types.ObjectId(), new Types.ObjectId()];

			mockTagRepository.findOneAndUpdate.resolves({});

			await tagService.decrementUsage(tagIds, mockSession);

			expect(mockTagRepository.findOneAndUpdate.calledTwice).to.be.true;
			// verify the $inc: { count: -1 } is in the update
			const firstCall = mockTagRepository.findOneAndUpdate.firstCall;
			expect(firstCall.args[1]).to.deep.include({ $inc: { count: -1 } });
		});

		it("should handle empty tag ID list", async () => {
			await tagService.decrementUsage([], mockSession);

			expect(mockTagRepository.findOneAndUpdate.called).to.be.false;
		});
	});
});

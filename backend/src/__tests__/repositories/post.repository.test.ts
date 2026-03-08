import { describe, beforeEach, afterEach, it } from "mocha";
import { expect } from "chai";
import sinon, { SinonStub } from "sinon";
import { Model, Types } from "mongoose";
import { PostRepository } from "@/repositories/post.repository";
import { TagRepository } from "@/repositories/tag.repository";
import { decodeCursor } from "@/utils/cursorCodec";

interface MockPostModel {
	aggregate: SinonStub;
	findOne: SinonStub;
}

describe("PostRepository", () => {
	let repository: PostRepository;
	let mockModel: MockPostModel;
	let mockTagRepository: { findByTags: SinonStub };

	beforeEach(() => {
		mockModel = {
			aggregate: sinon.stub(),
			findOne: sinon.stub(),
		};

		mockTagRepository = {
			findByTags: sinon.stub().resolves([]),
		};

		repository = new PostRepository(
			mockModel as unknown as Model<any>,
			mockTagRepository as unknown as TagRepository,
		);
	});

	afterEach(() => {
		sinon.restore();
	});

	it("sorts text-search results before limiting them", async () => {
		mockModel.aggregate.returns({
			exec: sinon.stub().resolves([]),
		});

		await repository.searchByText(["hello", "world"], 5);

		const pipeline = mockModel.aggregate.firstCall.args[0] as Array<Record<string, unknown>>;
		const stageNames = pipeline.map((stage) => Object.keys(stage)[0]);

		expect(stageNames.indexOf("$sort")).to.be.lessThan(stageNames.indexOf("$limit"));
	});

	it("keeps _id in hybrid feed projections so dedupe and cursors work", async () => {
		const personalizedId = new Types.ObjectId();
		const backfillId = new Types.ObjectId();
		const personalizedDate = new Date("2024-01-02T00:00:00.000Z");
		const backfillDate = new Date("2024-01-01T00:00:00.000Z");

		mockModel.aggregate.onFirstCall().returns({
			exec: sinon.stub().resolves([
				{
					_id: personalizedId,
					publicId: "post-1",
					createdAt: personalizedDate,
					isPersonalized: true,
				},
			]),
		});
		mockModel.aggregate.onSecondCall().returns({
			exec: sinon.stub().resolves([
				{
					_id: backfillId,
					publicId: "post-2",
					createdAt: backfillDate,
					isPersonalized: false,
				},
			]),
		});

		const result = await repository.getFeedForUserCoreWithCursor([new Types.ObjectId().toString()], [], { limit: 1 });

		const personalizedPipeline = mockModel.aggregate.firstCall.args[0] as Array<Record<string, unknown>>;
		const backfillPipeline = mockModel.aggregate.secondCall.args[0] as Array<Record<string, unknown>>;
		const personalizedProjection = personalizedPipeline.find((stage) => "$project" in stage)?.$project as Record<
			string,
			unknown
		>;
		const backfillProjection = backfillPipeline.find((stage) => "$project" in stage)?.$project as Record<
			string,
			unknown
		>;
		const decodedCursor = decodeCursor<{ _id: string; phase: string }>(result.nextCursor);

		expect(personalizedProjection._id).to.equal(1);
		expect(backfillProjection._id).to.equal(1);
		expect(result.data).to.have.length(1);
		expect(result.data[0].publicId).to.equal("post-1");
		expect(decodedCursor?._id).to.equal(personalizedId.toString());
		expect(decodedCursor?.phase).to.equal("personalized");
	});
});

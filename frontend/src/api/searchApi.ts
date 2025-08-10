import { IImage, ITag, IUser } from "../types";
import axiosClient from "./axiosClient";

export const searchQuery = async (
	query: string
): Promise<{
	status: string;
	data: {
		users: IUser[] | null;
		images: IImage[] | null;
		tags: ITag[] | null;
	};
}> => {
	const { data } = await axiosClient.get(`/api/search?q=${query}`);
	console.log(`Search Data: ${data.toString()}`);
	return data;
};

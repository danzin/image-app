import { useQuery } from "@tanstack/react-query";
import { fetchUser, User } from "../api/userApi";

export const useCurrentUser = () => {
  return useQuery<User>({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: 0, 
    refetchOnMount: true, 
    refetchOnWindowFocus: true
  });
};
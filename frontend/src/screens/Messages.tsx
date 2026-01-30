import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	Avatar,
	Box,
	Button,
	CircularProgress,
	IconButton,
	List,
	ListItemAvatar,
	ListItemButton,
	ListItemText,
	Paper,
	TextField,
	Typography,
	useMediaQuery,
	useTheme,
	alpha,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import {
	InfoOutlined as InfoOutlinedIcon,
	Image as ImageIcon,
	Gif as GifIcon,
	EmojiEmotions as EmojiEmotionsIcon,
} from "@mui/icons-material";
import { useConversations } from "../hooks/messaging/useConversations";
import { useConversationMessages } from "../hooks/messaging/useConversationMessages";
import { useSendMessage } from "../hooks/messaging/useSendMessage";
import { useMarkConversationRead } from "../hooks/messaging/useMarkConversationRead";
import { useAuth } from "../hooks/context/useAuth";
import { ConversationSummaryDTO, MessageDTO } from "../types";

const CONVERSATION_PANEL_WIDTH = 380;

const formatTimestamp = (timestamp: string) => {
	try {
		const date = new Date(timestamp);
		return new Intl.DateTimeFormat("en", {
			hour: "numeric",
			minute: "numeric",
			month: "short",
			day: "numeric",
		}).format(date);
	} catch {
		return timestamp;
	}
};

const getConversationTitle = (conversation: ConversationSummaryDTO, currentUserId?: string | null) => {
	if (conversation.title) {
		return conversation.title;
	}

	const others = conversation.participants.filter((participant) => participant.publicId !== currentUserId);
	if (others.length === 0 && conversation.participants.length > 0) {
		return conversation.participants[0].username;
	}

	const label = others.map((participant) => participant.username).join(", ");
	return label || "Direct Message";
};

const getOtherParticipant = (conversation: ConversationSummaryDTO, currentUserId?: string | null) => {
	const others = conversation.participants.filter((participant) => participant.publicId !== currentUserId);
	// return the first other participant, or null if somehow there are none
	return others[0] || null;
};

const getConversationAvatar = (conversation: ConversationSummaryDTO, currentUserId?: string | null) => {
	const other = getOtherParticipant(conversation, currentUserId);
	// only return the other participant's avatar, never fall back to current user's avatar
	return other?.avatar || "";
};

const Messages = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [draftBody, setDraftBody] = useState("");
	const { user } = useAuth();
	const messagesContainerRef = useRef<HTMLDivElement | null>(null);
	const lastMessageCountRef = useRef<number>(0);
	const markedAsReadRef = useRef<Set<string>>(new Set());
	const conversationsQuery = useConversations();

	const conversations = useMemo(
		() => conversationsQuery.data?.pages.flatMap((p) => p.conversations) ?? [],
		[conversationsQuery.data],
	);

	const selectedConversationId = useMemo(() => {
		const params = new URLSearchParams(location.search);
		return params.get("conversation");
	}, [location.search]);

	const firstConversationId = conversations[0]?.publicId;

	useEffect(() => {
		if (!selectedConversationId && firstConversationId && !isMobile) {
			navigate(`?conversation=${firstConversationId}`, { replace: true });
		}
	}, [firstConversationId, selectedConversationId, navigate, isMobile]);

	const markConversationRead = useMarkConversationRead();
	const selectedConversation = useMemo(() => {
		return conversations.find((c) => c.publicId === selectedConversationId);
	}, [conversations, selectedConversationId]);

	useEffect(() => {
		if (
			selectedConversation &&
			selectedConversation.unreadCount > 0 &&
			!markedAsReadRef.current.has(selectedConversation.publicId)
		) {
			markedAsReadRef.current.add(selectedConversation.publicId);
			markConversationRead.mutate(selectedConversation.publicId);
		}
		// reset tracking when conversation changes or unread count goes to 0
		if (selectedConversation && selectedConversation.unreadCount === 0) {
			markedAsReadRef.current.delete(selectedConversation.publicId);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedConversation?.publicId, selectedConversation?.unreadCount]);

	const messagesQuery = useConversationMessages(selectedConversationId);

	const messages = useMemo(() => {
		const pages = messagesQuery.data?.pages ?? [];
		const flattened = pages.flatMap((page) => page.messages);
		return [...flattened].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}, [messagesQuery.data?.pages]);

	useEffect(() => {
		if (!messagesContainerRef.current) return;
		if (!selectedConversationId) return;

		const currentCount = messages.length;
		const shouldScroll = currentCount > lastMessageCountRef.current;
		lastMessageCountRef.current = currentCount;

		if (shouldScroll) {
			messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: "smooth" });
		}
	}, [messages, selectedConversationId]);

	const sendMessage = useSendMessage();

	const handleSelectConversation = (conversationId: string) => {
		navigate(`?conversation=${conversationId}`);
	};
	const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!draftBody.trim() || !selectedConversationId) return;

		await sendMessage.mutateAsync({
			conversationPublicId: selectedConversationId,
			body: draftBody.trim(),
		});

		setDraftBody("");
		requestAnimationFrame(() => {
			if (messagesContainerRef.current) {
				messagesContainerRef.current.scrollTo({
					top: messagesContainerRef.current.scrollHeight,
					behavior: "smooth",
				});
			}
		});
	};

	const handleBackToList = () => {
		navigate("/messages");
	};

	const renderMessageBubble = (message: MessageDTO) => {
		const isOwnMessage = message.sender.publicId === user?.publicId;
		return (
			<Box
				key={message.publicId}
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: isOwnMessage ? "flex-end" : "flex-start",
					mb: 2,
					maxWidth: "100%",
				}}
			>
				<Box
					sx={{
						maxWidth: "70%",
						px: 2,
						py: 1.5,
						borderRadius: isOwnMessage ? "22px 22px 4px 22px" : "22px 22px 22px 4px",
						bgcolor: isOwnMessage ? "primary.main" : alpha(theme.palette.text.primary, 0.05),
						color: isOwnMessage ? "#fff" : "text.primary",
						position: "relative",
						wordBreak: "break-word",
						boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
					}}
				>
					<Typography variant="body1" sx={{ fontSize: "0.95rem", lineHeight: 1.5 }}>
						{message.body}
					</Typography>
				</Box>
				<Typography
					variant="caption"
					sx={{
						mt: 0.5,
						color: "text.secondary",
						fontSize: "0.75rem",
						px: 1,
					}}
				>
					{formatTimestamp(message.createdAt)}
				</Typography>
			</Box>
		);
	};

	return (
		<Box
			sx={{
				display: "flex",
				height: { xs: "calc(100vh - 56px)", md: "100vh" },
				maxHeight: { xs: "calc(100vh - 56px)", md: "100vh" },
				overflow: "hidden",
				bgcolor: "background.default",
			}}
		>
			{/* Conversation List */}
			<Box
				sx={{
					width: { xs: "100%", md: CONVERSATION_PANEL_WIDTH },
					display: { xs: selectedConversationId ? "none" : "flex", md: "flex" },
					flexDirection: "column",
					borderRight: `1px solid ${theme.palette.divider}`,
					height: "100%",
				}}
			>
				{/* Conversation List Header */}
				<Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<Typography variant="h5" fontWeight={800}>
						Messages
					</Typography>
				</Box>

				{/* Conversation List */}
				<Box sx={{ flex: 1, overflowY: "auto" }}>
					{conversationsQuery.isLoading ? (
						<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
							<CircularProgress size={32} />
						</Box>
					) : conversations.length === 0 ? (
						<Box sx={{ p: 4, textAlign: "center" }}>
							<Typography variant="h6" fontWeight={700} gutterBottom>
								Welcome to your inbox!
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Drop a line, share posts and more with private conversations between you and others.
							</Typography>
						</Box>
					) : (
						<List disablePadding>
							{conversations.map((conversation) => {
								const title = getConversationTitle(conversation, user?.publicId);
								const avatarUrl = getConversationAvatar(conversation, user?.publicId);
								const otherParticipant = getOtherParticipant(conversation, user?.publicId);
								const lastMessagePreview = conversation.lastMessage?.body ?? "No messages yet";
								const isSelected = conversation.publicId === selectedConversationId;

								return (
									<ListItemButton
										key={conversation.publicId}
										selected={isSelected}
										onClick={() => handleSelectConversation(conversation.publicId)}
										sx={{
											alignItems: "flex-start",
											py: 2,
											px: 2,
											borderRight: isSelected ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
											bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : "transparent",
											"&:hover": {
												bgcolor: alpha(theme.palette.text.primary, 0.03),
											},
										}}
									>
										<ListItemAvatar sx={{ minWidth: 56 }}>
											<Avatar src={avatarUrl} alt={title} sx={{ width: 40, height: 40 }}>
												{otherParticipant?.username?.charAt(0).toUpperCase()}
											</Avatar>
										</ListItemAvatar>
										<ListItemText
											primary={
												<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
													<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, overflow: "hidden" }}>
														<Typography variant="subtitle1" fontWeight={700} noWrap>
															{title}
														</Typography>
														<Typography variant="body2" color="text.secondary" noWrap>
															@{title.replace(/\s+/g, "").toLowerCase()}
														</Typography>
													</Box>
													<Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: "nowrap" }}>
														{conversation.lastMessageAt ? formatTimestamp(conversation.lastMessageAt) : ""}
													</Typography>
												</Box>
											}
											secondary={
												<Typography
													variant="body2"
													color={conversation.unreadCount > 0 ? "text.primary" : "text.secondary"}
													fontWeight={conversation.unreadCount > 0 ? 700 : 400}
													noWrap
													sx={{ mt: 0.5 }}
												>
													{lastMessagePreview}
												</Typography>
											}
										/>
									</ListItemButton>
								);
							})}
						</List>
					)}
				</Box>
			</Box>

			{/* Chat Window  */}
			<Box
				sx={{
					flex: 1,
					display: { xs: selectedConversationId ? "flex" : "none", md: "flex" },
					flexDirection: "column",
					height: "100%",
					bgcolor: "background.default",
				}}
			>
				{!selectedConversationId ? (
					<Box
						sx={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "column",
							p: 4,
						}}
					>
						<Typography variant="h4" fontWeight={800} gutterBottom>
							Select a message
						</Typography>
						<Typography variant="body1" color="text.secondary">
							Choose from your existing conversations, start a new one, or just keep swimming.
						</Typography>
						<Button variant="contained" size="large" sx={{ mt: 3, borderRadius: 9999, px: 4, py: 1.5 }}>
							New Message
						</Button>
					</Box>
				) : (
					<>
						{/* Chat Header */}
						<Box
							sx={{
								px: 2,
								py: 1,
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								borderBottom: `1px solid ${theme.palette.divider}`,
								bgcolor: alpha(theme.palette.background.default, 0.85),
								backdropFilter: "blur(12px)",
								position: "sticky",
								top: 0,
								zIndex: 10,
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
								{isMobile && (
									<IconButton size="small" onClick={handleBackToList}>
										<ArrowBackIosNewRoundedIcon fontSize="small" />
									</IconButton>
								)}
								{selectedConversation && (
									<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
										<Avatar
											src={getConversationAvatar(selectedConversation, user?.publicId)}
											sx={{ width: 32, height: 32 }}
										>
											{getOtherParticipant(selectedConversation, user?.publicId)?.username?.charAt(0).toUpperCase()}
										</Avatar>
										<Typography variant="h6" fontWeight={700} fontSize="1.1rem">
											{getConversationTitle(selectedConversation, user?.publicId)}
										</Typography>
									</Box>
								)}
							</Box>
							<IconButton>
								<InfoOutlinedIcon />
							</IconButton>
						</Box>

						{/* Messages Area */}
						<Box
							ref={messagesContainerRef}
							sx={{
								flex: 1,
								overflowY: "auto",
								px: 2,
								py: 2,
								display: "flex",
								flexDirection: "column",
							}}
						>
							{messagesQuery.isLoading ? (
								<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
									<CircularProgress size={32} />
								</Box>
							) : (
								<>
									{messagesQuery.hasNextPage && (
										<Button
											onClick={() => messagesQuery.fetchNextPage()}
											disabled={messagesQuery.isFetchingNextPage}
											sx={{ alignSelf: "center", mb: 2 }}
										>
											Load older messages
										</Button>
									)}
									{messages.map((message) => renderMessageBubble(message))}
								</>
							)}
						</Box>

						{/* Input Area */}
						<Box
							component="form"
							onSubmit={handleSendMessage}
							sx={{
								p: 1.5,
								borderTop: `1px solid ${theme.palette.divider}`,
								bgcolor: "background.default",
							}}
						>
							<Paper
								elevation={0}
								sx={{
									display: "flex",
									alignItems: "center",
									px: 1,
									py: 0.5,
									borderRadius: 4,
									bgcolor: alpha(theme.palette.text.primary, 0.05),
								}}
							>
								<IconButton size="small" color="primary">
									<ImageIcon />
								</IconButton>
								<IconButton size="small" color="primary">
									<GifIcon />
								</IconButton>
								<IconButton size="small" color="primary">
									<EmojiEmotionsIcon />
								</IconButton>

								<TextField
									fullWidth
									variant="standard"
									placeholder="Start a new message"
									value={draftBody}
									onChange={(event) => setDraftBody(event.target.value)}
									InputProps={{
										disableUnderline: true,
									}}
									sx={{ px: 2 }}
								/>

								<IconButton
									type="submit"
									color="primary"
									disabled={!draftBody.trim() || sendMessage.isPending}
									sx={{
										opacity: draftBody.trim() ? 1 : 0.5,
									}}
								>
									<SendRoundedIcon />
								</IconButton>
							</Paper>
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
};

export default Messages;

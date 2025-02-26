import React, { useState } from "react";
import { IconButton, Badge, Menu, MenuItem } from "@mui/material";
import { Notifications as NotificationsIcon } from "@mui/icons-material";
import { useNotifications } from "../hooks/notifications/useNotification";
import { Notification } from "../types";
import { Link } from "react-router-dom";

const NotificationBell = () => {
  const { notifications, markAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const unreadNotifications = notifications.filter((n: Notification) => !n.isRead);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId); 
    handleClose();
  };

  return (
    <>
      <IconButton size="large" color="inherit" onClick={handleOpen}>
        <Badge badgeContent={notifications.filter((n: Notification) => !n.isRead).length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {unreadNotifications.length === 0 ? (
          <MenuItem style={{ pointerEvents: 'none' }}>No new notifications</MenuItem>
        ) : (
          unreadNotifications
          .map((notification: Notification) =>(
            <MenuItem key={notification.id} onClick={() => handleNotificationClick(notification.id)}>
              {notification.actionType} by { <Link to={notification.actorId.username}/>  }
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;

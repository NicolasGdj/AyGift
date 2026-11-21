let nextNotification = 0;

export const uiMethods = {
  showNotification(message, type = 'success') {
    const id = ++nextNotification;
    this.notifications = this.notifications.filter(notification => notification.message !== message);
    this.notifications.push({ id, message, type });
    setTimeout(() => { this.notifications = this.notifications.filter(notification => notification.id !== id); }, 4000);
  }
};

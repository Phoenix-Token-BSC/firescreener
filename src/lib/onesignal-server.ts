const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_API_KEY;

export async function sendPriceAlertNotification(
  subscriptionIds: string[],
  title: string,
  body: string,
  url: string,
  iconUrl?: string,
  alertId?: string,
): Promise<void> {
  if (!APP_ID || !API_KEY || subscriptionIds.length === 0) return;

  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${API_KEY}`,
    },
    body: JSON.stringify({
      app_id: APP_ID,
      include_subscription_ids: subscriptionIds,
      headings: { en: title },
      contents: { en: body },
      url,
      chrome_web_icon: iconUrl,
      firefox_icon: iconUrl,
      // deduplicates with same-tagged local SW notification
      web_push_topic: alertId ? `price-alert-${alertId}` : undefined,
    }),
  });
}

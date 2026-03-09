"""
--< Notification engine for The Freshness Guard >--
--< Hard-coded triggers at 72 hours, 24 hours, and 1 hour before expiration >--
--< No AI — purely time-based comparisons >--
"""

from datetime import datetime, timedelta, timezone, date
from models import db, Item, Notification

# --< Hard-coded trigger thresholds in hours >--
TRIGGER_HOURS = [72, 24, 1]


def check_and_create_notifications(household_id):
    """
    --< Scan all active items in a household and create notification records >--
    --< for any item approaching its expiration within the trigger windows >--
    """
    now = datetime.now(timezone.utc)
    active_items = Item.query.filter_by(household_id=household_id, status='active').all()

    new_notifications = []

    for item in active_items:
        # --< Convert expiration date to datetime for hour-level comparison >--
        expiry_dt = datetime.combine(item.expiration_date, datetime.min.time()).replace(tzinfo=timezone.utc)

        for hours in TRIGGER_HOURS:
            trigger_time = expiry_dt - timedelta(hours=hours)

            if now >= trigger_time:
                # --< Check if this trigger already exists >--
                existing = Notification.query.filter_by(
                    item_id=item.id,
                    trigger_hours=hours
                ).first()

                if not existing:
                    notif = Notification(
                        item_id=item.id,
                        trigger_hours=hours,
                        triggered_at=now
                    )
                    db.session.add(notif)
                    new_notifications.append(notif)

    if new_notifications:
        db.session.commit()

    return new_notifications


def get_pending_notifications(household_id):
    """
    --< Retrieve all un-dismissed notifications for a household >--
    --< Returns notifications joined with item data for display >--
    """
    # --< First, generate any new notifications >--
    check_and_create_notifications(household_id)

    # --< Then fetch all un-dismissed ones >--
    notifications = (
        db.session.query(Notification, Item)
        .join(Item, Notification.item_id == Item.id)
        .filter(
            Item.household_id == household_id,
            Item.status == 'active',
            Notification.dismissed == False
        )
        .order_by(Notification.trigger_hours.asc())
        .all()
    )

    result = []
    for notif, item in notifications:
        entry = notif.to_dict()
        entry['item_name'] = item.name
        entry['expiration_date'] = item.expiration_date.isoformat()
        entry['days_until_expiry'] = (item.expiration_date - date.today()).days

        # --< Human-readable urgency label >--
        if notif.trigger_hours == 1:
            entry['urgency'] = 'URGENT'
        elif notif.trigger_hours == 24:
            entry['urgency'] = 'WARNING'
        else:
            entry['urgency'] = 'HEADS UP'

        result.append(entry)

    return result


def dismiss_notification(notification_id):
    """--< Mark a notification as dismissed so it won't show again >--"""
    notif = Notification.query.get(notification_id)
    if notif:
        notif.dismissed = True
        db.session.commit()
        return True
    return False

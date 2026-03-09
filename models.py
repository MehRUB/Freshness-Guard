"""
--< Database models for The Freshness Guard >--
--< SQLAlchemy ORM models: Household, Item, HistoryEntry, Notification >--
--< No AI — all data is user-inputted or hard-coded >--
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import uuid
import string
import random

db = SQLAlchemy()


def generate_invite_code():
    """--< Generate a 6-character uppercase invite code for household sharing >--"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


class Household(db.Model):
    """--< A household groups multiple devices/users around one shared fridge list >--"""
    __tablename__ = 'households'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    invite_code = db.Column(db.String(6), unique=True, nullable=False, default=generate_invite_code)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # --< Relationships >--
    items = db.relationship('Item', backref='household', lazy=True, cascade='all, delete-orphan')
    history = db.relationship('HistoryEntry', backref='household', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'invite_code': self.invite_code,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Item(db.Model):
    """--< A tracked food item with an expiration date >--"""
    __tablename__ = 'items'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id = db.Column(db.String(36), db.ForeignKey('households.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    barcode = db.Column(db.String(50), nullable=True)
    expiration_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='active')  # --< active | used | wasted >--
    category = db.Column(db.String(50), nullable=True)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # --< Relationships >--
    notifications = db.relationship('Notification', backref='item', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        from datetime import date
        now = date.today()
        delta = (self.expiration_date - now).days

        if delta < 0:
            freshness = 'expired'
        elif delta < 2:
            freshness = 'critical'  # --< Orange: < 48 hours >--
        elif delta < 7:
            freshness = 'warning'   # --< Yellow: < 7 days >--
        else:
            freshness = 'safe'      # --< Green: safe >--

        return {
            'id': self.id,
            'household_id': self.household_id,
            'name': self.name,
            'barcode': self.barcode,
            'expiration_date': self.expiration_date.isoformat(),
            'status': self.status,
            'category': self.category,
            'freshness': freshness,
            'days_until_expiry': delta,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class HistoryEntry(db.Model):
    """--< Log entry for items that were used or wasted >--"""
    __tablename__ = 'history'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id = db.Column(db.String(36), db.ForeignKey('households.id'), nullable=False)
    item_name = db.Column(db.String(200), nullable=False)
    action = db.Column(db.String(20), nullable=False)  # --< used | wasted >--
    original_expiry = db.Column(db.Date, nullable=True)
    action_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    estimated_cost = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'id': self.id,
            'household_id': self.household_id,
            'item_name': self.item_name,
            'action': self.action,
            'original_expiry': self.original_expiry.isoformat() if self.original_expiry else None,
            'action_date': self.action_date.isoformat() if self.action_date else None,
            'estimated_cost': self.estimated_cost
        }


class Notification(db.Model):
    """--< Hard-coded notification triggers at 72h, 24h, and 1h before expiry >--"""
    __tablename__ = 'notifications'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = db.Column(db.String(36), db.ForeignKey('items.id'), nullable=False)
    trigger_hours = db.Column(db.Integer, nullable=False)  # --< 72, 24, or 1 >--
    triggered_at = db.Column(db.DateTime, nullable=True)
    dismissed = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'item_id': self.item_id,
            'trigger_hours': self.trigger_hours,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'dismissed': self.dismissed
        }

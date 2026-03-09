"""
--< REST API routes for The Freshness Guard >--
--< Endpoints: Items CRUD, Households, History, Notifications, Shopping List, Donation Map >--
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta, timezone
from models import db, Household, Item, HistoryEntry
from notifications import get_pending_notifications, dismiss_notification

api = Blueprint('api', __name__)


# --< ============================================================ >--
# --<                       HOUSEHOLD ROUTES                        >--
# --< ============================================================ >--

@api.route('/api/households', methods=['POST'])
def create_household():
    """--< Create a new household with a unique invite code >--"""
    data = request.get_json()
    name = data.get('name', 'My Household')

    household = Household(name=name)
    db.session.add(household)
    db.session.commit()

    return jsonify(household.to_dict()), 201


@api.route('/api/households/join', methods=['POST'])
def join_household():
    """--< Join an existing household by invite code >--"""
    data = request.get_json()
    code = data.get('invite_code', '').upper().strip()

    household = Household.query.filter_by(invite_code=code).first()
    if not household:
        return jsonify({'error': 'Invalid invite code'}), 404

    return jsonify(household.to_dict()), 200


@api.route('/api/households/<household_id>', methods=['GET'])
def get_household(household_id):
    """--< Get household details >--"""
    household = Household.query.get(household_id)
    if not household:
        return jsonify({'error': 'Household not found'}), 404
    return jsonify(household.to_dict()), 200


# --< ============================================================ >--
# --<                         ITEM ROUTES                           >--
# --< ============================================================ >--

@api.route('/api/items', methods=['GET'])
def get_items():
    """--< Get all active items for a household, sorted by expiration >--"""
    household_id = request.args.get('household_id')
    if not household_id:
        return jsonify({'error': 'household_id is required'}), 400

    items = (
        Item.query
        .filter_by(household_id=household_id, status='active')
        .order_by(Item.expiration_date.asc())
        .all()
    )

    return jsonify([item.to_dict() for item in items]), 200


@api.route('/api/items', methods=['POST'])
def add_item():
    """--< Add a new item — the core of the 3-second flow >--"""
    data = request.get_json()

    # --< Validate required fields >--
    if not data.get('name') or not data.get('expiration_date') or not data.get('household_id'):
        return jsonify({'error': 'name, expiration_date, and household_id are required'}), 400

    item = Item(
        household_id=data['household_id'],
        name=data['name'],
        barcode=data.get('barcode'),
        expiration_date=date.fromisoformat(data['expiration_date']),
        category=data.get('category', 'General')
    )

    db.session.add(item)
    db.session.commit()

    return jsonify(item.to_dict()), 201


@api.route('/api/items/<item_id>', methods=['PUT'])
def update_item(item_id):
    """--< Update an item's details >--"""
    item = Item.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    data = request.get_json()

    if 'name' in data:
        item.name = data['name']
    if 'expiration_date' in data:
        item.expiration_date = date.fromisoformat(data['expiration_date'])
    if 'category' in data:
        item.category = data['category']

    item.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify(item.to_dict()), 200


@api.route('/api/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    """--< Remove an item entirely (not tracked in history) >--"""
    item = Item.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    db.session.delete(item)
    db.session.commit()

    return jsonify({'message': 'Item deleted'}), 200


@api.route('/api/items/<item_id>/mark', methods=['POST'])
def mark_item(item_id):
    """--< Mark an item as used or wasted — moves it to history >--"""
    item = Item.query.get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    data = request.get_json()
    action = data.get('action')  # --< 'used' or 'wasted' >--

    if action not in ('used', 'wasted'):
        return jsonify({'error': 'Action must be "used" or "wasted"'}), 400

    # --< Create history entry >--
    history = HistoryEntry(
        household_id=item.household_id,
        item_name=item.name,
        action=action,
        original_expiry=item.expiration_date,
        estimated_cost=data.get('estimated_cost', 0.0)
    )

    # --< Update item status >--
    item.status = action
    item.updated_at = datetime.now(timezone.utc)

    db.session.add(history)
    db.session.commit()

    return jsonify({
        'item': item.to_dict(),
        'history': history.to_dict()
    }), 200


# --< ============================================================ >--
# --<                        HISTORY ROUTES                         >--
# --< ============================================================ >--

@api.route('/api/history', methods=['GET'])
def get_history():
    """--< Get the history log for a household >--"""
    household_id = request.args.get('household_id')
    if not household_id:
        return jsonify({'error': 'household_id is required'}), 400

    entries = (
        HistoryEntry.query
        .filter_by(household_id=household_id)
        .order_by(HistoryEntry.action_date.desc())
        .all()
    )

    # --< Calculate waste summary >--
    total_wasted = sum(1 for e in entries if e.action == 'wasted')
    total_used = sum(1 for e in entries if e.action == 'used')
    total_waste_cost = sum(e.estimated_cost for e in entries if e.action == 'wasted')

    return jsonify({
        'entries': [e.to_dict() for e in entries],
        'summary': {
            'total_wasted': total_wasted,
            'total_used': total_used,
            'total_waste_cost': round(total_waste_cost, 2),
            'use_rate': round(total_used / max(total_used + total_wasted, 1) * 100, 1)
        }
    }), 200


# --< ============================================================ >--
# --<                     NOTIFICATION ROUTES                       >--
# --< ============================================================ >--

@api.route('/api/notifications', methods=['GET'])
def get_notifications():
    """--< Get pending notifications for a household >--"""
    household_id = request.args.get('household_id')
    if not household_id:
        return jsonify({'error': 'household_id is required'}), 400

    notifications = get_pending_notifications(household_id)
    return jsonify(notifications), 200


@api.route('/api/notifications/<notification_id>/dismiss', methods=['POST'])
def dismiss(notification_id):
    """--< Dismiss a notification >--"""
    success = dismiss_notification(notification_id)
    if success:
        return jsonify({'message': 'Notification dismissed'}), 200
    return jsonify({'error': 'Notification not found'}), 404


# --< ============================================================ >--
# --<                      SHOPPING LIST                            >--
# --< ============================================================ >--

@api.route('/api/shopping-list', methods=['GET'])
def shopping_list():
    """
    --< Generate a shopping list from items previously marked as "used" >--
    --< Premium feature: shows frequently used items for quick re-purchase >--
    """
    household_id = request.args.get('household_id')
    if not household_id:
        return jsonify({'error': 'household_id is required'}), 400

    # --< Find unique item names that were marked as "used" >--
    used_entries = (
        HistoryEntry.query
        .filter_by(household_id=household_id, action='used')
        .all()
    )

    # --< Count frequency of each item >--
    item_counts = {}
    for entry in used_entries:
        name = entry.item_name
        if name in item_counts:
            item_counts[name]['count'] += 1
            if entry.action_date and entry.action_date > item_counts[name]['last_used']:
                item_counts[name]['last_used'] = entry.action_date
        else:
            item_counts[name] = {
                'name': name,
                'count': 1,
                'last_used': entry.action_date
            }

    # --< Sort by frequency (most used first) >--
    shopping = sorted(item_counts.values(), key=lambda x: x['count'], reverse=True)

    for item in shopping:
        if item['last_used']:
            item['last_used'] = item['last_used'].isoformat()

    return jsonify(shopping), 200


# --< ============================================================ >--
# --<                       DONATION MAP                            >--
# --< ============================================================ >--

@api.route('/api/donation-map', methods=['GET'])
def donation_map():
    """
    --< Placeholder endpoint for donation map data >--
    --< In production, this would load from a CSV or external API >--
    --< Shows nearby food banks for items expiring within 48 hours >--
    """
    # --< Hard-coded sample data — replace with CSV/API integration >--
    sample_locations = [
        {
            'name': 'City Food Bank',
            'address': '123 Main Street',
            'phone': '(555) 123-4567',
            'hours': 'Mon-Fri 9AM-5PM',
            'accepts': 'Non-perishable foods, canned goods',
            'lat': 40.7128,
            'lng': -74.0060
        },
        {
            'name': 'Community Kitchen',
            'address': '456 Oak Avenue',
            'phone': '(555) 987-6543',
            'hours': 'Mon-Sat 8AM-6PM',
            'accepts': 'All food items, perishable included',
            'lat': 40.7580,
            'lng': -73.9855
        },
        {
            'name': 'Neighborhood Pantry',
            'address': '789 Elm Drive',
            'phone': '(555) 456-7890',
            'hours': 'Tue-Thu 10AM-4PM',
            'accepts': 'Packaged foods, produce',
            'lat': 40.7484,
            'lng': -73.9857
        }
    ]

    return jsonify(sample_locations), 200

---
description: How to set a user as admin
---

# Setting Admin Users

To grant admin access to a user, you need to run an internal Convex mutation.

## Steps

1. Make sure the user has signed up and logged in at least once (so they exist in the database)

2. Get the user's email address

// turbo
3. Run the following command in your terminal:

```bash
npx convex run admin:setAdminUser '{"email": "user@example.com"}'
```

Replace `user@example.com` with the actual email address of the user you want to make an admin.

**Note**: The arguments must be in JSON format, wrapped in single quotes.

4. The command will return success and the user ID if successful

5. The user can now access the admin dashboard at `/admin`

## Verification

To verify the user is now an admin:

1. Have the user log in
2. Navigate to `/admin`
3. They should see the admin dashboard instead of an "Access Denied" message

## Notes

- Admin users cannot be deactivated or deleted through the admin interface
- Admin users are automatically marked as active when granted admin access
- You can revoke admin access by manually updating the user's `isAdmin` field to `false` in the Convex dashboard

# Supabase Database Migrations

This directory contains SQL migration files for the Trippee database schema.

## 📁 Directory Structure

```
supabase/
├── migrations/          # Version-controlled migration files
│   └── 001_auth_schema.sql
├── fix_rls_recursion.sql  # One-time fix scripts
├── clear_test_data.sql    # Utility scripts
└── README.md
```

## ✅ Why Keep Migrations in Repo?

**Yes, you should commit migration files because:**

1. **Version Control** - Track schema changes over time
2. **Reproducibility** - Anyone can set up the database from scratch
3. **Documentation** - Shows the evolution of your schema
4. **Team Collaboration** - Everyone knows what migrations to run
5. **Deployment** - Can automate migrations in CI/CD

## 🚀 How to Use

### Running Migrations

1. **Go to Supabase Dashboard** → SQL Editor
2. **Copy the migration file** content
3. **Paste and run** in SQL Editor
4. **Run in order** (001, 002, 003, etc.)

### Migration Naming Convention

- `001_<description>.sql` - First migration
- `002_<description>.sql` - Second migration
- etc.

### One-Time Fix Scripts

Scripts like `fix_rls_recursion.sql` are one-time fixes that should be:
- ✅ Committed to repo (for reference)
- ⚠️ Only run once (check if already applied)
- 📝 Documented with what they fix

## 📝 Current Migrations

### `001_auth_schema.sql`
- Creates `profiles` table
- Creates `trip_members` table
- Creates `trip_invitations` table
- Updates `trips` and `places` tables with `created_by`
- Sets up Row Level Security (RLS) policies
- Creates helper functions

**Status:** Run this first to set up authentication

### `fix_rls_recursion.sql`
- Fixes infinite recursion in RLS policies
- Creates `is_trip_member()` helper function
- Updates trips and trip_members policies

**Status:** Run this if you get recursion errors

## ⚠️ Important Notes

1. **Never modify existing migrations** - Create new ones instead
2. **Test migrations** on a development database first
3. **Backup production** before running migrations
4. **Run in order** - Migrations may depend on previous ones
5. **Document breaking changes** in migration comments

## 🔄 Migration Workflow

1. Create new migration file: `002_<feature>.sql`
2. Test locally in Supabase
3. Commit to git
4. Deploy to production
5. Run migration in production Supabase

## 🛠️ Utility Scripts

### `clear_test_data.sql`
- Clears all test data from tables
- Safe to run multiple times
- Does NOT delete user accounts

### `fix_rls_recursion.sql`
- One-time fix for RLS recursion
- Safe to run multiple times (uses `CREATE OR REPLACE`)

## 📚 Best Practices

1. **One feature per migration** - Keep migrations focused
2. **Idempotent when possible** - Use `IF NOT EXISTS`, `CREATE OR REPLACE`
3. **Add comments** - Explain what and why
4. **Test rollback** - Know how to undo if needed
5. **Version control** - Always commit migration files


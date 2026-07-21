#include "services/database_service.h"
#include "sqlite3.h"
#include <stdio.h>

// Keep the database handle scoped entirely to this service file
static sqlite3 *g_db = NULL;

bool db_init(const char *db_path) {
    if (db_path == NULL) {
        fprintf(stderr, "[DB ERROR] Database path cannot be NULL.\n");
        return false;
    }

    // 1. Open (or create) the database file
    // SQLITE_OPEN_FULLMUTEX ensures safe usage across Mongoose's event loops/threads
    int rc = sqlite3_open_v2(db_path, &g_db, 
                             SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, 
                             NULL);

    if (rc != SQLITE_OK) {
        fprintf(stderr, "[DB ERROR] Cannot open database: %s\n", sqlite3_errmsg(g_db));
        db_close();
        return false;
    }

    printf("[DB INFO] Successfully connected to database at: %s\n", db_path);

    // 2. Create tables if they don't exist yet
    // We'll track encrypted records here. Adjust columns as your crypto design evolves!
    const char *create_table_sql = 
        "CREATE TABLE IF NOT EXISTS encrypted_records ("
        "id TEXT PRIMARY KEY, "
        "iv TEXT NOT NULL, "
        "auth_tag TEXT, "
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ");";

    char *err_msg = NULL;
    rc = sqlite3_exec(g_db, create_table_sql, NULL, NULL, &err_msg);

    if (rc != SQLITE_OK) {
        fprintf(stderr, "[DB ERROR] Failed to create schema: %s\n", err_msg);
        sqlite3_free(err_msg);
        db_close();
        return false;
    }

    printf("[DB INFO] Database schema is up to date.\n");
    return true;
}

void db_close(void) {
    if (g_db != NULL) {
        sqlite3_close(g_db);
        g_db = NULL;
        printf("[DB INFO] Database connection closed gracefully.\n");
    }
}
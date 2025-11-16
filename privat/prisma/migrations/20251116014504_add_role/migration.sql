-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userCode" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Hey there! I''m using PrivaT.',
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "id", "name", "passwordHash", "privacy", "status", "updatedAt", "userCode") SELECT "avatarUrl", "createdAt", "id", "name", "passwordHash", "privacy", "status", "updatedAt", "userCode" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

// Node.js Server for Database Connections
/**
 * INK AND ARCH TIME TRACKING SERVER
 * ==================================
 *
 * Express.js server providing RESTful APIs for a medical clinic time tracking system.
 * Features dual database support (SQLite primary, MongoDB backup) with automatic
 * patient status monitoring, user authentication, and comprehensive data management.
 *
 * Core Features:
 * - SQLite database for local data storage and fast queries
 * - MongoDB Atlas integration for cloud backup and sync
 * - Authentication system with role-based permissions
 * - Automatic patient status monitoring (inactive after 6 months)
 * - Real-time database backup and restore functionality
 * - RESTful API endpoints for all major entities
 *
 * @author Ink and Arch Development Team
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MongoDB Configuration
const MONGODB_URI = "mongodb+srv://kkjmangoltad132:kkjmangoltad132@cluster0.3bldu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "inkandarch";

// Create MongoDB client
const mongoClient = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
  ssl: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false
});

// SQLite Database Setup with persistence
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'inkandarch.db');
const backupPath = path.join(dataDir, 'inkandarch_backup.sql');
let sqliteDb = null;

// Ensure data directory exists
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Created data directory');
}

// Database connection status
let mongoConnected = false;
let sqliteConnected = false;

// Email configuration using nodemailer
// Using Gmail SMTP with app-specific password (or use your own email service)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'your-app-password'
  }
});

// Verify email configuration
emailTransporter.verify(function(error, success) {
  if (error) {
    console.warn('��️ Email service not configured:', error.message);
    console.warn('⚠️ Set SMTP_USER and SMTP_PASSWORD environment variables to enable email sending');
  } else {
    console.log('✅ Email service ready');
  }
});

// Initialize databases
async function initializeDatabases() {
  // Initialize SQLite first (more reliable)
  try {
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('❌ SQLite connection error:', err);
        sqliteConnected = false;
      } else {
        sqliteConnected = true;
        console.log('✅ Connected to SQLite database!');

        // Create tables first
        createSQLiteTables();

        // Fix database schema for existing databases
        await fixDatabaseSchema();

        // Check if database is empty and only restore if it is
        const isEmpty = await isDatabaseEmpty();
        if (isEmpty) {
          console.log('📦 Database is empty, attempting to restore from backup...');
          const restored = await restoreDatabase();
          if (!restored) {
            console.log('🆕 No backup found, creating sample data...');
            createSampleUsers();
          }
        } else {
          console.log('📊 Database has existing data, skipping restore');
        }

        // Start auto-backup system
        startAutoBackup();

        // Start patient status monitoring
        startPatientStatusMonitoring();
      }
    });
  } catch (error) {
    console.error('❌ SQLite initialization error:', error);
    sqliteConnected = false;
  }

  // Try MongoDB with timeout
  try {
    console.log('🔌 Attempting MongoDB connection...');
    const mongoPromise = mongoClient.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000)
    );

    await Promise.race([mongoPromise, timeoutPromise]);
    await mongoClient.db("admin").command({ ping: 1 });

    // Create the inkandarch database and main collection
    const db = mongoClient.db(DB_NAME);
    await db.createCollection('inkandarchdata');

    // Create indexes for better performance
    await db.collection('inkandarchdata').createIndex({ type: 1 }); // Index by document type
    await db.collection('inkandarchdata').createIndex({ email: 1 }); // Index by email for users/employees
    await db.collection('inkandarchdata').createIndex({ date: 1 }); // Index by date for time entries

    mongoConnected = true;
    console.log("�� Connected to MongoDB Atlas!");
    console.log(`📊 Database '${DB_NAME}' created/verified with collections`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('📝 App will work with SQLite database only');
    mongoConnected = false;
  }
}

// Create SQLite tables
function createSQLiteTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      position TEXT,
      status TEXT DEFAULT 'active',
      avatar TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS employee_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      name TEXT NOT NULL,
      email TEXT,
      position TEXT,
      status TEXT DEFAULT 'active',
      avatar TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      archived_reason TEXT,
      data_snapshot TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      clock_in DATETIME,
      clock_out DATETIME,
      date TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      address TEXT,
      date_of_birth TEXT,
      status TEXT DEFAULT 'active',
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      comprehensive_data TEXT
    )`,
    
    `CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      min_quantity INTEGER DEFAULT 0,
      unit TEXT,
      description TEXT,
      expiry_date DATE,
      supplier TEXT,
      platform TEXT,
      purchase_cost DECIMAL(10,2) DEFAULT 0,
      date_received DATE,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      treatment TEXT,
      amount DECIMAL(10,2),
      date DATETIME,
      status TEXT DEFAULT 'scheduled',
      FOREIGN KEY (patient_id) REFERENCES patients (id)
    )`,

    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'front_desk', 'employee')),
      first_name TEXT,
      last_name TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  tables.forEach(tableSQL => {
    sqliteDb.run(tableSQL, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      }
    });
  });

  // Run migrations after tables are created
  setTimeout(() => {
    runDatabaseMigrations();
  }, 500);

  // Create sample users after tables are created
  setTimeout(() => {
    createSampleUsers();
  }, 1000);
}

// Run database migrations
function runDatabaseMigrations() {
  // Check if columns exist in patients table
  sqliteDb.all("PRAGMA table_info(patients)", [], (err, columns) => {
    if (err) {
      console.error('Error checking patients table structure:', err);
      return;
    }

    const hasCompDataColumn = columns.some(col => col.name === 'comprehensive_data');
    if (!hasCompDataColumn) {
      sqliteDb.run('ALTER TABLE patients ADD COLUMN comprehensive_data TEXT', (alterErr) => {
        if (alterErr) {
          console.error('Error adding comprehensive_data column:', alterErr);
        } else {
          console.log('✅ Added comprehensive_data column to patients table');
        }
      });
    }

    const hasIsDeletedColumn = columns.some(col => col.name === 'is_deleted');
    if (!hasIsDeletedColumn) {
      sqliteDb.run('ALTER TABLE patients ADD COLUMN is_deleted INTEGER DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding is_deleted column:', alterErr);
        } else {
          console.log('✅ Added is_deleted column to patients table');
        }
      });
    }

    const hasDeletedAtColumn = columns.some(col => col.name === 'deleted_at');
    if (!hasDeletedAtColumn) {
      sqliteDb.run('ALTER TABLE patients ADD COLUMN deleted_at DATETIME', (alterErr) => {
        if (alterErr) {
          console.error('Error adding deleted_at column:', alterErr);
        } else {
          console.log('✅ Added deleted_at column to patients table');
        }
      });
    }
  });

  // Check if columns exist in appointments table
  sqliteDb.all("PRAGMA table_info(appointments)", [], (err, columns) => {
    if (err) {
      console.error('Error checking appointments table structure:', err);
      return;
    }

    const hasPaymentStatusColumn = columns.some(col => col.name === 'payment_status');
    if (!hasPaymentStatusColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN payment_status TEXT DEFAULT "partial"', (alterErr) => {
        if (alterErr) {
          console.error('Error adding payment_status column:', alterErr);
        } else {
          console.log('✅ Added payment_status column to appointments table');
        }
      });
    }

    const hasPaymentMethodColumn = columns.some(col => col.name === 'payment_method');
    if (!hasPaymentMethodColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN payment_method TEXT DEFAULT "cash"', (alterErr) => {
        if (alterErr) {
          console.error('Error adding payment_method column:', alterErr);
        } else {
          console.log('✅ Added payment_method column to appointments table');
        }
      });
    }

    const hasDownPaymentColumn = columns.some(col => col.name === 'down_payment');
    if (!hasDownPaymentColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN down_payment DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding down_payment column:', alterErr);
        } else {
          console.log('✅ Added down_payment column to appointments table');
        }
      });
    }

    const hasCashPaymentColumn = columns.some(col => col.name === 'cash_payment');
    if (!hasCashPaymentColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN cash_payment DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding cash_payment column:', alterErr);
        } else {
          console.log('✅ Added cash_payment column to appointments table');
        }
      });
    }

    const hasBankTransferColumn = columns.some(col => col.name === 'bank_transfer');
    if (!hasBankTransferColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN bank_transfer DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding bank_transfer column:', alterErr);
        } else {
          console.log('✅ Added bank_transfer column to appointments table');
        }
      });
    }

    const hasExpensesColumn = columns.some(col => col.name === 'expenses');
    if (!hasExpensesColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN expenses DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding expenses column:', alterErr);
        } else {
          console.log('��� Added expenses column to appointments table');
        }
      });
    }

    const hasDiscountTypeColumn = columns.some(col => col.name === 'discount_type');
    if (!hasDiscountTypeColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN discount_type TEXT DEFAULT "amount"', (alterErr) => {
        if (alterErr) {
          console.error('Error adding discount_type column:', alterErr);
        } else {
          console.log('✅ Added discount_type column to appointments table');
        }
      });
    }

    const hasDiscountValueColumn = columns.some(col => col.name === 'discount_value');
    if (!hasDiscountValueColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding discount_value column:', alterErr);
        } else {
          console.log('✅ Added discount_value column to appointments table');
        }
      });
    }

    const hasPriceBeforeDiscountColumn = columns.some(col => col.name === 'price_before_discount');
    if (!hasPriceBeforeDiscountColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN price_before_discount DECIMAL(10,2) DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding price_before_discount column:', alterErr);
        } else {
          console.log('✅ Added price_before_discount column to appointments table');
        }
      });
    }

    const hasPaymentReferenceColumn = columns.some(col => col.name === 'payment_reference');
    if (!hasPaymentReferenceColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN payment_reference TEXT', (alterErr) => {
        if (alterErr) {
          console.error('Error adding payment_reference column:', alterErr);
        } else {
          console.log('✅ Added payment_reference column to appointments table');
        }
      });
    }

    const hasNotesColumn = columns.some(col => col.name === 'notes');
    if (!hasNotesColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN notes TEXT', (alterErr) => {
        if (alterErr) {
          console.error('Error adding notes column:', alterErr);
        } else {
          console.log('✅ Added notes column to appointments table');
        }
      });
    }

    const hasStaffColumn = columns.some(col => col.name === 'staff');
    if (!hasStaffColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN staff INTEGER', (alterErr) => {
        if (alterErr) {
          console.error('Error adding staff column:', alterErr);
        } else {
          console.log('✅ Added staff column to appointments table');
        }
      });
    }

    const hasCreatedAtColumn = columns.some(col => col.name === 'created_at');
    if (!hasCreatedAtColumn) {
      sqliteDb.run('ALTER TABLE appointments ADD COLUMN created_at DATETIME', (alterErr) => {
        if (alterErr) {
          console.error('Error adding created_at column:', alterErr);
        } else {
          console.log('✅ Added created_at column to appointments table');
        }
      });
    }
  });

  // Check if columns exist in employees table
  sqliteDb.all("PRAGMA table_info(employees)", [], (err, columns) => {
    if (err) {
      console.error('Error checking employees table structure:', err);
      return;
    }

    const hasIsDeletedColumn = columns.some(col => col.name === 'is_deleted');
    if (!hasIsDeletedColumn) {
      sqliteDb.run('ALTER TABLE employees ADD COLUMN is_deleted INTEGER DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding is_deleted column:', alterErr);
        } else {
          console.log('✅ Added is_deleted column to employees table');
        }
      });
    }

    const hasDeletedAtColumn = columns.some(col => col.name === 'deleted_at');
    if (!hasDeletedAtColumn) {
      sqliteDb.run('ALTER TABLE employees ADD COLUMN deleted_at DATETIME', (alterErr) => {
        if (alterErr) {
          console.error('Error adding deleted_at column:', alterErr);
        } else {
          console.log('✅ Added deleted_at column to employees table');
        }
      });
    }
  });

  // Check if employee_archive table exists
  sqliteDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_archive'", (err, row) => {
    if (err) {
      console.error('Error checking for employee_archive table:', err);
      return;
    }

    if (!row) {
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS employee_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        name TEXT NOT NULL,
        email TEXT,
        position TEXT,
        status TEXT DEFAULT 'active',
        avatar TEXT,
        archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_reason TEXT,
        data_snapshot TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (createErr) => {
        if (createErr) {
          console.error('Error creating employee_archive table:', createErr);
        } else {
          console.log('✅ Created employee_archive table');
        }
      });
    }
  });
}

// Database backup and restore functions
async function backupDatabase() {
  if (!sqliteConnected || !sqliteDb) return;

  try {
    console.log('📦 Creating database backup...');

    // Export database to SQL format
    const tables = ['users', 'employees', 'time_entries', 'patients', 'inventory', 'appointments'];
    let backupSQL = '-- SQLite Database Backup\n';

    for (const table of tables) {
      try {
        // Get table schema
        const schema = await new Promise((resolve, reject) => {
          sqliteDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
            if (err) reject(err);
            else resolve(row?.sql || '');
          });
        });

        if (schema) {
          backupSQL += `\n-- Table: ${table}\n`;
          backupSQL += `DROP TABLE IF EXISTS ${table};\n`;
          backupSQL += `${schema};\n`;

          // Get table data
          const rows = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM ${table}`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const values = rows.map(row =>
              `(${columns.map(col => {
                const val = row[col];
                return val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ')})`
            ).join(',\n  ');

            backupSQL += `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n  ${values};\n`;
          }
        }
      } catch (tableError) {
        console.log(`⚠️ Could not backup table ${table}:`, tableError.message);
      }
    }

    // Write backup file
    fs.writeFileSync(backupPath, backupSQL);
    console.log('✅ Database backup created successfully');

  } catch (error) {
    console.error('��� Database backup failed:', error);
  }
}

async function isDatabaseEmpty() {
  try {
    // Check if restore points exist - if they do, database is not empty
    const restorePoints = getRestorePoints();
    if (restorePoints.length > 0) {
      return false;
    }

    // Check if users table has any data
    const userCount = await new Promise((resolve, reject) => {
      sqliteDb.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    return userCount === 0;
  } catch (error) {
    console.log('📊 Could not check if database is empty (probably no tables yet):', error.message);
    return true; // Assume empty if we can't check
  }
}

async function restoreDatabase() {
  if (!fs.existsSync(backupPath)) {
    console.log('📝 No backup file found, starting with fresh database');
    return false;
  }

  try {
    console.log('📥 Restoring database from backup...');

    const backupSQL = fs.readFileSync(backupPath, 'utf8');
    const statements = backupSQL.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await new Promise((resolve, reject) => {
          sqliteDb.run(statement.trim(), (err) => {
            if (err) {
              // Ignore errors for tables that already exist
              if (err.message.includes('already exists')) {
                console.log(`ℹ️ Skipping statement (table already exists): ${statement.trim().substring(0, 50)}...`);
                resolve();
              } else {
                reject(err);
              }
            } else {
              resolve();
            }
          });
        });
      }
    }

    console.log('✅ Database restored successfully');
    return true;

  } catch (error) {
    console.error('❌ Database restore failed:', error);
    return false;
  }
}

// Restore points management
const BACKUP_RETENTION_DAYS = 7;
const BACKUP_STORAGE_LIMIT_GB = 5;
const BACKUP_STORAGE_LIMIT_BYTES = BACKUP_STORAGE_LIMIT_GB * 1024 * 1024 * 1024;
const RESTORE_POINTS_DIR = path.join(dataDir, 'restore_points');

// Ensure restore points directory exists
if (!fs.existsSync(RESTORE_POINTS_DIR)) {
  fs.mkdirSync(RESTORE_POINTS_DIR, { recursive: true });
  console.log('📁 Created restore points directory');
}

// Get all restore points
function getRestorePoints() {
  try {
    if (!fs.existsSync(RESTORE_POINTS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(RESTORE_POINTS_DIR);
    const restorePoints = files
      .filter(f => f.startsWith('restore_point_') && f.endsWith('.sql'))
      .map(f => {
        const timestamp = f.replace('restore_point_', '').replace('.sql', '');
        const filePath = path.join(RESTORE_POINTS_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          timestamp: timestamp,
          filename: f,
          size: stats.size,
          sizeHumanReadable: formatBytes(stats.size),
          date: new Date(parseInt(timestamp)),
          createdAt: new Date(parseInt(timestamp)).toISOString()
        };
      })
      .sort((a, b) => b.date - a.date);

    return restorePoints;
  } catch (error) {
    console.error('Error getting restore points:', error);
    return [];
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Calculate total backup storage usage
function getTotalBackupStorageUsage() {
  try {
    let totalSize = 0;

    if (fs.existsSync(RESTORE_POINTS_DIR)) {
      const files = fs.readdirSync(RESTORE_POINTS_DIR);
      files.forEach(f => {
        const filePath = path.join(RESTORE_POINTS_DIR, f);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });
    }

    return {
      total: totalSize,
      totalHumanReadable: formatBytes(totalSize),
      limit: BACKUP_STORAGE_LIMIT_BYTES,
      limitHumanReadable: formatBytes(BACKUP_STORAGE_LIMIT_BYTES),
      percentage: Math.round((totalSize / BACKUP_STORAGE_LIMIT_BYTES) * 100),
      isLimitReached: totalSize >= BACKUP_STORAGE_LIMIT_BYTES
    };
  } catch (error) {
    console.error('Error calculating backup storage usage:', error);
    return {
      total: 0,
      totalHumanReadable: '0 Bytes',
      limit: BACKUP_STORAGE_LIMIT_BYTES,
      limitHumanReadable: formatBytes(BACKUP_STORAGE_LIMIT_BYTES),
      percentage: 0,
      isLimitReached: false
    };
  }
}

// Clean up old restore points
async function cleanupOldRestorePoints() {
  try {
    const restorePoints = getRestorePoints();
    const now = new Date();

    for (const point of restorePoints) {
      const daysDiff = Math.floor((now - point.date) / (1000 * 60 * 60 * 24));

      if (daysDiff > BACKUP_RETENTION_DAYS) {
        const filePath = path.join(RESTORE_POINTS_DIR, point.filename);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted old restore point: ${point.filename} (${daysDiff} days old)`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old restore points:', error);
  }
}

// Auto-backup every hour
function startAutoBackup() {
  setInterval(async () => {
    await createRestorePoint();
    cleanupOldRestorePoints();
  }, 1 * 60 * 60 * 1000); // 1 hour

  console.log('🔄 Auto-backup started (every hour)');
}

// Create a new restore point
async function createRestorePoint() {
  if (!sqliteConnected || !sqliteDb) return;

  try {
    console.log('📦 Creating restore point...');

    const timestamp = Date.now();
    const restorePointFilename = `restore_point_${timestamp}.sql`;
    const restorePointPath = path.join(RESTORE_POINTS_DIR, restorePointFilename);

    // Export database to SQL format
    const tables = ['users', 'employees', 'time_entries', 'patients', 'inventory', 'appointments'];
    let backupSQL = '-- SQLite Database Restore Point\n';
    backupSQL += `-- Created: ${new Date().toISOString()}\n`;

    for (const table of tables) {
      try {
        // Get table schema
        const schema = await new Promise((resolve, reject) => {
          sqliteDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
            if (err) reject(err);
            else resolve(row?.sql || '');
          });
        });

        if (schema) {
          backupSQL += `\n-- Table: ${table}\n`;
          backupSQL += `DROP TABLE IF EXISTS ${table};\n`;
          backupSQL += `${schema};\n`;

          // Get table data
          const rows = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM ${table}`, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const values = rows.map(row =>
              `(${columns.map(col => {
                const val = row[col];
                return val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ')})`
            ).join(',\n  ');

            backupSQL += `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n  ${values};\n`;
          }
        }
      } catch (tableError) {
        console.log(`⚠️ Could not backup table ${table}:`, tableError.message);
      }
    }

    // Write restore point file
    fs.writeFileSync(restorePointPath, backupSQL);
    console.log(`✅ Restore point created: ${restorePointFilename}`);

    // Check storage limit
    const storageUsage = getTotalBackupStorageUsage();
    if (storageUsage.isLimitReached) {
      console.warn(`⚠️ Backup storage limit reached (${storageUsage.totalHumanReadable} / ${storageUsage.limitHumanReadable})`);
    }

  } catch (error) {
    console.error('❌ Restore point creation failed:', error);
  }
}

// Restore from a restore point
async function restoreFromPoint(restorePointFilename) {
  if (!sqliteConnected || !sqliteDb) return false;

  try {
    const restorePointPath = path.join(RESTORE_POINTS_DIR, restorePointFilename);

    if (!fs.existsSync(restorePointPath)) {
      console.error('Restore point file not found:', restorePointFilename);
      return false;
    }

    console.log(`📥 Restoring from restore point: ${restorePointFilename}`);

    const backupSQL = fs.readFileSync(restorePointPath, 'utf8');
    const statements = backupSQL.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await new Promise((resolve, reject) => {
          sqliteDb.run(statement.trim(), (err) => {
            if (err) {
              if (err.message.includes('already exists')) {
                resolve();
              } else {
                reject(err);
              }
            } else {
              resolve();
            }
          });
        });
      }
    }

    console.log('✅ Database restored successfully from restore point');
    return true;

  } catch (error) {
    console.error('❌ Database restore failed:', error);
    return false;
  }
}

// Patient status management functions
async function updatePatientStatuses() {
  if (!sqliteConnected || !sqliteDb) return;

  try {
    console.log('🔄 Checking patient statuses...');

    // Get all active patients
    const activePatients = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT id, name, registration_date FROM patients WHERE status = "active"', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const patient of activePatients) {
      // Check last appointment for this patient
      const lastAppointment = await new Promise((resolve, reject) => {
        sqliteDb.get(
          'SELECT MAX(date) as last_appointment FROM appointments WHERE patient_id = ?',
          [patient.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const lastActivityDate = lastAppointment?.last_appointment
        ? new Date(lastAppointment.last_appointment)
        : new Date(patient.registration_date);

      // If no activity for 6 months, mark as inactive
      if (lastActivityDate < sixMonthsAgo) {
        await new Promise((resolve, reject) => {
          sqliteDb.run(
            'UPDATE patients SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [patient.id],
            function(err) {
              if (err) reject(err);
              else {
                console.log(`👤 Marked patient ${patient.name} as inactive (no activity since ${lastActivityDate.toDateString()})`);
                resolve();
              }
            }
          );
        });
      }
    }
  } catch (error) {
    console.error('❌ Error updating patient statuses:', error);
  }
}

// Function to reactivate patient when they make an appointment
async function reactivatePatient(patientId) {
  if (!sqliteConnected || !sqliteDb) return;

  try {
    await new Promise((resolve, reject) => {
      sqliteDb.run(
        'UPDATE patients SET status = "active" WHERE id = ? AND status = "inactive"',
        [patientId],
        function(err) {
          if (err) reject(err);
          else {
            if (this.changes > 0) {
              console.log(`✅ Reactivated patient ID ${patientId}`);
            }
            resolve();
          }
        }
      );
    });
  } catch (error) {
    console.error('�� Error reactivating patient:', error);
  }
}

// Start patient status monitoring (run daily)
function startPatientStatusMonitoring() {
  // Run immediately on startup
  setTimeout(() => {
    updatePatientStatuses();
  }, 5000);

  // Then run daily
  setInterval(() => {
    updatePatientStatuses();
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('🔄 Patient status monitoring started (daily checks)');
}

// Generate initials-based avatar (server-side version)
function generateInitialsAvatar(firstName, lastName) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();

  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  const colorIndex = initials.charCodeAt(0) % colors.length;
  const backgroundColor = colors[colorIndex];

  const svg = `
    <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="75" fill="${backgroundColor}"/>
      <text x="75" y="85" font-family="Arial, sans-serif" font-size="48" font-weight="bold"
            text-anchor="middle" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Fix database schema for existing databases
async function fixDatabaseSchema() {
  if (!sqliteConnected || !sqliteDb) return;

  try {
    console.log('🔧 Checking database schema...');

    // Check if expiry_date column exists in inventory table
    const inventoryColumns = await new Promise((resolve, reject) => {
      sqliteDb.all("PRAGMA table_info(inventory)", [], (err, columns) => {
        if (err) reject(err);
        else resolve(columns);
      });
    });

    const hasExpiryDate = inventoryColumns.some(col => col.name === 'expiry_date');

    if (!hasExpiryDate) {
      console.log('⚡ Adding expiry_date column to inventory table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE inventory ADD COLUMN expiry_date DATE", function(err) {
          if (err) {
            console.error('❌ Error adding expiry_date column:', err.message);
            reject(err);
          } else {
            console.log('✅ Added expiry_date column to inventory table');
            resolve();
          }
        });
      });
    } else {
      console.log('✅ expiry_date column already exists');
    }

    // Ensure purchase detail columns exist
    const hasSupplier = inventoryColumns.some(col => col.name === 'supplier');
    const hasPlatform = inventoryColumns.some(col => col.name === 'platform');
    const hasPurchaseCost = inventoryColumns.some(col => col.name === 'purchase_cost');
    const hasDateReceived = inventoryColumns.some(col => col.name === 'date_received');

    if (!hasSupplier) {
      console.log('⚡ Adding supplier column to inventory table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE inventory ADD COLUMN supplier TEXT", function(err) {
          if (err) reject(err); else resolve();
        });
      });
    }
    if (!hasPlatform) {
      console.log('⚡ Adding platform column to inventory table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE inventory ADD COLUMN platform TEXT", function(err) {
          if (err) reject(err); else resolve();
        });
      });
    }
    if (!hasPurchaseCost) {
      console.log('⚡ Adding purchase_cost column to inventory table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE inventory ADD COLUMN purchase_cost DECIMAL(10,2) DEFAULT 0", function(err) {
          if (err) reject(err); else resolve();
        });
      });
    }
    if (!hasDateReceived) {
      console.log('�� Adding date_received column to inventory table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE inventory ADD COLUMN date_received DATE", function(err) {
          if (err) reject(err); else resolve();
        });
      });
    }

    // Check if updated_at column exists in patients table
    const patientColumns = await new Promise((resolve, reject) => {
      sqliteDb.all("PRAGMA table_info(patients)", [], (err, columns) => {
        if (err) reject(err);
        else resolve(columns);
      });
    });

    const hasUpdatedAt = patientColumns.some(col => col.name === 'updated_at');

    if (!hasUpdatedAt) {
      console.log('⚡ Adding updated_at column to patients table...');
      await new Promise((resolve, reject) => {
        sqliteDb.run("ALTER TABLE patients ADD COLUMN updated_at DATETIME", function(err) {
          if (err) {
            console.error('❌ Error adding updated_at column:', err.message);
            reject(err);
          } else {
            console.log('✅ Added updated_at column to patients table');
            resolve();
          }
        });
      });
    } else {
      console.log('✅ updated_at column already exists');
    }

  } catch (error) {
    console.error('❌ Database schema fix failed:', error);
  }
}

// Create sample users for both databases
async function createSampleUsers() {
  console.log('🔄 Starting sample user creation process...');
  const sampleUsers = [
    {
      username: 'admin123',
      email: 'admin123@inkandarch.com',
      password: 'admin123',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'User',
      avatar: generateInitialsAvatar('Admin', 'User')
    },
    {
      username: 'frontdesk123',
      email: 'frontdesk123@inkandarch.com',
      password: 'password123',
      role: 'front_desk',
      first_name: 'Front',
      last_name: 'Desk',
      avatar: generateInitialsAvatar('Front', 'Desk')
    },
    {
      username: 'employee123',
      email: 'employee123@inkandarch.com',
      password: 'employee123',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'User',
      avatar: generateInitialsAvatar('Employee', 'User')
    }
  ];

  // Create users in SQLite
  if (sqliteConnected) {
    console.log(`📝 Attempting to create ${sampleUsers.length} users in SQLite...`);
    sampleUsers.forEach(user => {
      console.log(`👤 Creating user: ${user.username} with password: ${user.password}`);
      sqliteDb.run(
        `INSERT OR IGNORE INTO users (username, email, password, role, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.username, user.email, user.password, user.role, user.first_name, user.last_name],
        function(err) {
          if (err && !err.message.includes('UNIQUE constraint failed')) {
            console.error('Error creating SQLite user:', err);
          } else if (this.changes > 0) {
            console.log(`✅ Created SQLite user: ${user.username} (${user.role})`);
          }
        }
      );

      // Also create corresponding employee record
      sqliteDb.run(
        `INSERT OR IGNORE INTO employees (name, email, position, status, avatar)
         VALUES (?, ?, ?, ?, ?)`,
        [
          `${user.first_name} ${user.last_name}`,
          user.email,
          user.role === 'admin' ? 'Administrator' : user.role === 'front_desk' ? 'Front Desk' : 'Employee',
          'active',
          user.avatar
        ],
        function(err) {
          if (err && !err.message.includes('UNIQUE constraint failed')) {
            console.error('Error creating SQLite employee:', err);
          } else if (this.changes > 0) {
            console.log(`✅ Created SQLite employee: ${user.first_name} ${user.last_name}`);
          }
        }
      );
    });
  }

  // Create users in MongoDB
  if (mongoConnected) {
    try {
      const db = mongoClient.db(DB_NAME);
      const mainCollection = db.collection('inkandarchdata');

      for (const user of sampleUsers) {
        const existingUser = await mainCollection.findOne({
          type: 'user',
          username: user.username
        });
        if (!existingUser) {
          await mainCollection.insertOne({
            ...user,
            type: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Created MongoDB user: ${user.username} (${user.role})`);
        }

        // Also create corresponding employee record
        const existingEmployee = await mainCollection.findOne({
          type: 'employee',
          email: user.email
        });
        if (!existingEmployee) {
          await mainCollection.insertOne({
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            position: user.role === 'admin' ? 'Administrator' : user.role === 'front_desk' ? 'Front Desk' : 'Employee',
            status: 'active',
            department: user.role === 'admin' ? 'management' : user.role === 'front_desk' ? 'reception' : 'staff',
            avatar: user.avatar,
            type: 'employee',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Created MongoDB employee: ${user.first_name} ${user.last_name}`);
        }
      }
    } catch (error) {
      console.error('Error creating MongoDB users:', error);
    }
  }
}

// API Routes

// Enhanced health check with database testing
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    databases: {
      sqlite: {
        connected: sqliteConnected,
        error: null
      },
      mongodb: {
        connected: mongoConnected,
        error: null
      }
    }
  };

  // Test SQLite connection
  if (sqliteConnected && sqliteDb) {
    try {
      await new Promise((resolve, reject) => {
        sqliteDb.get('SELECT 1 as test', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      health.databases.sqlite.status = 'healthy';
    } catch (error) {
      health.databases.sqlite.connected = false;
      health.databases.sqlite.error = error.message;
      health.databases.sqlite.status = 'error';
    }
  }

  // Test MongoDB connection
  if (mongoConnected) {
    try {
      const db = mongoClient.db(DB_NAME);
      await db.admin().ping();
      health.databases.mongodb.status = 'healthy';
    } catch (error) {
      health.databases.mongodb.connected = false;
      health.databases.mongodb.error = error.message;
      health.databases.mongodb.status = 'error';
    }
  }

  // Determine overall status
  const hasHealthyDB = health.databases.sqlite.connected || health.databases.mongodb.connected;
  if (!hasHealthyDB) {
    health.status = 'ERROR';
    res.status(503);
  }

  res.json(health);
});

// Database repair and reconnection endpoint
app.post('/api/repair-database', async (req, res) => {
  try {
    console.log('🔧 Starting database repair process...');

    // Attempt to reconnect SQLite
    if (!sqliteConnected) {
      try {
        sqliteDb = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            console.error('Failed to reconnect SQLite:', err);
          } else {
            sqliteConnected = true;
            console.log('✅ SQLite reconnected successfully');
          }
        });
      } catch (error) {
        console.error('SQLite repair failed:', error);
      }
    }

    // Attempt to reconnect MongoDB
    if (!mongoConnected) {
      try {
        await mongoClient.connect();
        await mongoClient.db("admin").command({ ping: 1 });
        mongoConnected = true;
        console.log('✅ MongoDB reconnected successfully');
      } catch (error) {
        console.error('MongoDB repair failed:', error);
      }
    }

    res.json({
      success: true,
      message: 'Database repair process completed',
      sqlite: sqliteConnected,
      mongodb: mongoConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database repair failed',
      error: error.message
    });
  }
});

// Manual backup endpoint (creates restore point)
app.post('/api/backup-database', async (req, res) => {
  try {
    await createRestorePoint();
    const storageUsage = getTotalBackupStorageUsage();

    res.json({
      success: true,
      message: 'Database backup created successfully',
      timestamp: new Date().toISOString(),
      storageUsage: storageUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database backup failed',
      error: error.message
    });
  }
});

// Get all restore points
app.get('/api/restore-points', (req, res) => {
  try {
    const restorePoints = getRestorePoints();
    const storageUsage = getTotalBackupStorageUsage();

    res.json({
      success: true,
      restorePoints: restorePoints,
      storageUsage: storageUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get restore points',
      error: error.message
    });
  }
});

// Get backup storage usage
app.get('/api/backup-storage-usage', (req, res) => {
  try {
    const storageUsage = getTotalBackupStorageUsage();

    res.json({
      success: true,
      storageUsage: storageUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get backup storage usage',
      error: error.message
    });
  }
});

// Restore from a specific restore point
app.post('/api/restore-database', async (req, res) => {
  try {
    const { restorePointFilename } = req.body;

    if (!restorePointFilename) {
      return res.status(400).json({
        success: false,
        message: 'Restore point filename is required'
      });
    }

    const success = await restoreFromPoint(restorePointFilename);

    if (success) {
      res.json({
        success: true,
        message: 'Database restored successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Database restore failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database restore failed',
      error: error.message
    });
  }
});

// Delete a restore point
app.delete('/api/restore-points/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const restorePointPath = path.join(RESTORE_POINTS_DIR, filename);

    // Validate filename to prevent directory traversal
    if (!filename.startsWith('restore_point_') || !filename.endsWith('.sql')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restore point filename'
      });
    }

    if (!fs.existsSync(restorePointPath)) {
      return res.status(404).json({
        success: false,
        message: 'Restore point not found'
      });
    }

    fs.unlinkSync(restorePointPath);
    const storageUsage = getTotalBackupStorageUsage();

    res.json({
      success: true,
      message: 'Restore point deleted successfully',
      storageUsage: storageUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete restore point',
      error: error.message
    });
  }
});

// Get all data from inkandarchdata collection (for debugging)
app.get('/api/mongodb/inkandarchdata', async (req, res) => {
  try {
    if (!mongoConnected) throw new Error('MongoDB not connected');

    const db = mongoClient.db(DB_NAME);
    const allData = await db.collection('inkandarchdata').find({}).toArray();

    // Group by type for better organization
    const groupedData = {};
    allData.forEach(item => {
      const type = item.type || 'unknown';
      if (!groupedData[type]) {
        groupedData[type] = [];
      }
      groupedData[type].push(item);
    });

    res.json({
      total: allData.length,
      types: Object.keys(groupedData),
      data: groupedData,
      raw: allData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test connections
app.post('/api/test-connection', async (req, res) => {
  const { type } = req.body;
  
  try {
    if (type === 'mongodb') {
      if (mongoConnected) {
        const db = mongoClient.db(DB_NAME);
        await db.command({ ping: 1 });
        res.json({
          success: true,
          message: 'MongoDB connection successful',
          details: {
            cluster: 'cluster0.3bldu.mongodb.net',
            database: DB_NAME,
            connectionTime: new Date().toISOString()
          }
        });
      } else {
        throw new Error('MongoDB not connected');
      }
    } else if (type === 'sqlite') {
      if (sqliteConnected) {
        res.json({
          success: true,
          message: 'SQLite connection successful',
          details: {
            database: dbPath,
            connectionTime: new Date().toISOString()
          }
        });
      } else {
        throw new Error('SQLite not connected');
      }
    } else {
      throw new Error('Invalid database type');
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// MongoDB CRUD Operations using single collection

// Get employees from MongoDB
app.get('/api/mongodb/employees', async (req, res) => {
  try {
    if (!mongoConnected) throw new Error('MongoDB not connected');

    const db = mongoClient.db(DB_NAME);
    const employees = await db.collection('inkandarchdata').find({ type: 'employee' }).toArray();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create employee in MongoDB
app.post('/api/mongodb/employees', async (req, res) => {
  try {
    if (!mongoConnected) throw new Error('MongoDB not connected');

    const db = mongoClient.db(DB_NAME);
    const result = await db.collection('inkandarchdata').insertOne({
      ...req.body,
      type: 'employee',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      insertedId: result.insertedId,
      document: result.ops ? result.ops[0] : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SQLite CRUD Operations

// Get employees from SQLite
app.get('/api/sqlite/employees', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  sqliteDb.all('SELECT * FROM employees ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Create employee in SQLite
app.post('/api/sqlite/employees', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  const { name, email, position, status = 'active', avatar } = req.body;
  
  sqliteDb.run(
    'INSERT INTO employees (name, email, position, status, avatar) VALUES (?, ?, ?, ?, ?)',
    [name, email, position, status, avatar],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          id: this.lastID,
          changes: this.changes
        });
      }
    }
  );
});

// Update employee in SQLite
app.put('/api/sqlite/employees/:id', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  const { id } = req.params;
  const { name, email, position, status, avatar } = req.body;

  sqliteDb.run(
    'UPDATE employees SET name = ?, email = ?, position = ?, status = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, email, position, status, avatar, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          changes: this.changes
        });
      }
    }
  );
});

// Archive employee (soft delete to employee_archive table)
app.post('/api/sqlite/employees/:id/archive', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  const { id } = req.params;
  const { reason } = req.body;

  sqliteDb.get('SELECT * FROM employees WHERE id = ?', [id], (err, employee) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const dataSnapshot = JSON.stringify(employee);

    sqliteDb.run(
      'INSERT INTO employee_archive (employee_id, name, email, position, status, avatar, archived_reason, data_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, employee.name, employee.email, employee.position, 'archived', employee.avatar, reason || null, dataSnapshot],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        sqliteDb.run(
          'UPDATE employees SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: updateErr.message });
            }

            res.json({
              success: true,
              message: 'Employee archived successfully',
              archiveId: this.lastID
            });
          }
        );
      }
    );
  });
});

// Delete employee (hard delete)
app.delete('/api/sqlite/employees/:id', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  const { id } = req.params;

  sqliteDb.run(
    'DELETE FROM employees WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          changes: this.changes,
          message: 'Employee deleted successfully'
        });
      }
    }
  );
});

// Generic /api/employees endpoint (for backward compatibility)
app.get('/api/employees', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  sqliteDb.all('SELECT * FROM employees WHERE is_deleted = 0 ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Generic POST /api/employees endpoint
app.post('/api/employees', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  const { name, email, position, status = 'active', avatar } = req.body;

  sqliteDb.run(
    'INSERT INTO employees (name, email, position, status, avatar) VALUES (?, ?, ?, ?, ?)',
    [name, email, position, status, avatar],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          id: this.lastID,
          changes: this.changes
        });
      }
    }
  );
});

// Authentication endpoint with robust error handling
app.post('/api/auth/login', (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/username and password are required'
    });
  }

  if (!sqliteConnected) {
    console.error('Authentication failed: SQLite database not connected');
    return res.status(500).json({
      success: false,
      message: 'Database not available. Please try again later.'
    });
  }

  // Query database for user
  const query = `
    SELECT id, username, email, password, role, first_name, last_name, status
    FROM users
    WHERE (email = ? OR username = ?) AND status = 'active'
  `;

  console.log(`🔍 Attempting login for: ${emailOrUsername}`);
  console.log(`🔍 Using query: ${query}`);

  sqliteDb.get(query, [emailOrUsername, emailOrUsername], (err, user) => {
    if (err) {
      console.error('❌ Database error during login:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error occurred'
      });
    }

    console.log(`🔍 User found in database:`, user ? { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status } : 'No user found');

    if (!user) {
      console.log(`❌ No user found for: ${emailOrUsername}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password'
      });
    }

    // Check password (in production, this should be hashed)
    console.log(`🔍 Password check - provided: "${password}", stored: "${user.password}", match: ${user.password === password}`);

    if (user.password !== password) {
      console.log(`❌ Password mismatch for user: ${user.username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password'
      });
    }

    // Generate a simple token (in production, use JWT)
    const token = `token_${user.id}_${Date.now()}`;

    // Return successful login response
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.role === 'admin' ? ['all'] :
          user.role === 'front_desk' ? ['dashboard', 'patients', 'inventory', 'timetracking', 'records'] :
          user.role === 'employee' ? ['dashboard', 'timetracking'] : ['dashboard'],
        employeeId: user.id
      }
    });
  });
});

// User management endpoints
app.post('/api/users', (req, res) => {
  const { username, email, password, role, first_name, last_name } = req.body;

  console.log('���� Creating user with data:', {
    username, email, role, first_name, last_name,
    password: password ? '[PROVIDED]' : '[MISSING]'
  });

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  // Validate required fields
  if (!username || !email || !password || !role) {
    return res.status(400).json({
      error: 'Missing required fields: username, email, password, and role are required'
    });
  }

  // Validate role
  const validRoles = ['admin', 'front_desk', 'employee'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`
    });
  }

  sqliteDb.run(
    'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
    [username, email, password, role, first_name, last_name],
    function(err) {
      if (err) {
        console.error('Error creating user:', err);

        // Provide specific error messages for common constraint violations
        if (err.message.includes('UNIQUE constraint failed: users.email')) {
          return res.status(409).json({ error: 'Email address is already in use' });
        } else if (err.message.includes('UNIQUE constraint failed: users.username')) {
          return res.status(409).json({ error: 'Username is already in use' });
        } else if (err.message.includes('CHECK constraint failed')) {
          return res.status(400).json({ error: 'Invalid role specified' });
        } else {
          return res.status(500).json({ error: 'Failed to create user: ' + err.message });
        }
      }

      console.log('✅ User created successfully with ID:', this.lastID);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Patient management endpoints
app.get('/api/patients', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const includeInactive = req.query.includeInactive === 'true';
  const includeArchived = req.query.includeArchived === 'true';
  let whereConditions = ['is_deleted = 0'];

  if (!includeInactive) {
    whereConditions.push('status = "active"');
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  const statusFilter = includeArchived ? 'WHERE is_deleted = 0' : whereClause;

  sqliteDb.all(`SELECT * FROM patients ${statusFilter} ORDER BY name`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const parsedRows = (rows || []).map(patient => {
        if (patient.comprehensive_data) {
          try {
            patient.comprehensive_data = JSON.parse(patient.comprehensive_data);
          } catch (e) {
            console.warn(`Warning: Could not parse comprehensive_data for patient ${patient.id}`);
          }
        }
        return patient;
      });
      res.json(parsedRows);
    }
  });
});

app.post('/api/patients', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { name, email, mobile, address, date_of_birth, comprehensive_data } = req.body;
  const compDataJson = comprehensive_data ? JSON.stringify(comprehensive_data) : null;

  sqliteDb.run(
    'INSERT INTO patients (name, email, mobile, address, date_of_birth, comprehensive_data, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
    [name, email, mobile, address, date_of_birth, compDataJson],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          id: this.lastID,
          changes: this.changes
        });
      }
    }
  );
});

app.put('/api/patients/:id', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { id } = req.params;
  const { name, email, mobile, address, date_of_birth, comprehensive_data } = req.body;
  const compDataJson = comprehensive_data ? JSON.stringify(comprehensive_data) : null;

  // Check if updated_at column exists
  sqliteDb.all("PRAGMA table_info(patients)", [], (err, columns) => {
    if (err) {
      console.error('Error checking patients table structure:', err);
      return res.status(500).json({ error: 'Database structure error' });
    }

    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
    const hasCompData = columns.some(col => col.name === 'comprehensive_data');
    let updateQuery, updateParams;

    if (hasUpdatedAt && hasCompData) {
      updateQuery = 'UPDATE patients SET name = ?, email = ?, mobile = ?, address = ?, date_of_birth = ?, comprehensive_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      updateParams = [name, email, mobile, address, date_of_birth, compDataJson, id];
    } else if (hasUpdatedAt) {
      updateQuery = 'UPDATE patients SET name = ?, email = ?, mobile = ?, address = ?, date_of_birth = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      updateParams = [name, email, mobile, address, date_of_birth, id];
    } else if (hasCompData) {
      updateQuery = 'UPDATE patients SET name = ?, email = ?, mobile = ?, address = ?, date_of_birth = ?, comprehensive_data = ? WHERE id = ?';
      updateParams = [name, email, mobile, address, date_of_birth, compDataJson, id];
    } else {
      updateQuery = 'UPDATE patients SET name = ?, email = ?, mobile = ?, address = ?, date_of_birth = ? WHERE id = ?';
      updateParams = [name, email, mobile, address, date_of_birth, id];
    }

    sqliteDb.run(updateQuery, updateParams, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          changes: this.changes
        });
      }
    });
  });
});

app.put('/api/patients/:id/status', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either active or inactive' });
  }

  // Check if updated_at column exists
  sqliteDb.all("PRAGMA table_info(patients)", [], (err, columns) => {
    if (err) {
      console.error('Error checking patients table structure:', err);
      return res.status(500).json({ error: 'Database structure error' });
    }

    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
    let updateQuery, updateParams;

    if (hasUpdatedAt) {
      updateQuery = 'UPDATE patients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      updateParams = [status, id];
    } else {
      updateQuery = 'UPDATE patients SET status = ? WHERE id = ?';
      updateParams = [status, id];
    }

    sqliteDb.run(updateQuery, updateParams, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          success: true,
          changes: this.changes
        });
      }
    });
  });
});

// Soft-delete patient (archive)
app.delete('/api/patients/:id', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { id } = req.params;

  sqliteDb.run(
    'UPDATE patients SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      return res.json({ success: true, archived: this.changes });
    }
  );
});

// Get archived patients
app.get('/api/patients/archived', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.all('SELECT * FROM patients WHERE is_deleted = 1 ORDER BY deleted_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const parsedRows = (rows || []).map(patient => {
        if (patient.comprehensive_data) {
          try {
            patient.comprehensive_data = JSON.parse(patient.comprehensive_data);
          } catch (e) {
            console.warn(`Warning: Could not parse comprehensive_data for patient ${patient.id}`);
          }
        }
        return patient;
      });
      res.json(parsedRows);
    }
  });
});

// Permanently delete archived patient (after retention period)
app.delete('/api/patients/:id/permanent', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { id } = req.params;

  sqliteDb.serialize(() => {
    sqliteDb.run('DELETE FROM appointments WHERE patient_id = ?', [id], function (aptErr) {
      if (aptErr) {
        console.error('Error deleting appointments for patient', id, aptErr);
      }
      sqliteDb.run('DELETE FROM patients WHERE id = ?', [id], function (patErr) {
        if (patErr) {
          return res.status(500).json({ error: patErr.message });
        }
        return res.json({ success: true, permanentlyDeleted: this.changes });
      });
    });
  });
});

// Appointment creation endpoint that reactivates patients and handles inventory
app.post('/api/appointments', async (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const {
    patient_id,
    treatment,
    amount,
    date,
    notes,
    itemsUsed,
    payment_status,
    payment_method,
    down_payment,
    cash_payment,
    bank_transfer,
    expenses,
    discount_type,
    discount_value,
    price_before_discount,
    payment_reference,
    staff
  } = req.body;

  try {
    // Create the appointment with payment information
    const appointmentId = await new Promise((resolve, reject) => {
      sqliteDb.run(
        `INSERT INTO appointments (
          patient_id, treatment, amount, date, status,
          payment_status, payment_method, down_payment, cash_payment, bank_transfer,
          expenses, discount_type, discount_value, price_before_discount, payment_reference, notes, staff
        ) VALUES (?, ?, ?, ?, "scheduled", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patient_id,
          treatment,
          amount,
          date,
          payment_status || 'partial',
          payment_method || 'cash',
          down_payment || 0,
          cash_payment || 0,
          bank_transfer || 0,
          expenses || 0,
          discount_type || 'amount',
          discount_value || 0,
          price_before_discount || amount,
          payment_reference || '',
          notes || '',
          staff || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    console.log(`✅ Appointment ${appointmentId} created for patient ${patient_id}`);

    // Process inventory items if provided
    if (itemsUsed && itemsUsed.length > 0) {
      console.log(`📦 Processing ${itemsUsed.length} inventory items for appointment ${appointmentId}`);

      for (const item of itemsUsed) {
        try {
          // Get current inventory item
          const currentItem = await new Promise((resolve, reject) => {
            sqliteDb.get(
              'SELECT * FROM inventory WHERE id = ?',
              [item.id],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          if (currentItem) {
            const newQuantity = Math.max(0, currentItem.quantity - item.quantity);

            // Update inventory quantity (handle missing columns gracefully)
            await new Promise((resolve, reject) => {
              // Check if last_updated column exists
              sqliteDb.all("PRAGMA table_info(inventory)", [], (err, columns) => {
                if (err) {
                  reject(err);
                  return;
                }

                const hasLastUpdated = columns.some(col => col.name === 'last_updated');
                let updateQuery, updateParams;

                if (hasLastUpdated) {
                  updateQuery = 'UPDATE inventory SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?';
                  updateParams = [newQuantity, item.id];
                } else {
                  updateQuery = 'UPDATE inventory SET quantity = ? WHERE id = ?';
                  updateParams = [newQuantity, item.id];
                }

                sqliteDb.run(updateQuery, updateParams, function(err) {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });

            console.log(`📦 Updated ${currentItem.name}: ${currentItem.quantity} → ${newQuantity} (used: ${item.quantity})`);
          } else {
            console.warn(`⚠️ Inventory item with ID ${item.id} not found`);
          }
        } catch (inventoryError) {
          console.error(`❌ Error updating inventory item ${item.id}:`, inventoryError);
        }
      }
    }

    // Reactivate patient if they were inactive
    await reactivatePatient(patient_id);

    res.json({
      success: true,
      id: appointmentId,
      message: 'Appointment created successfully',
      inventoryUpdated: itemsUsed ? itemsUsed.length : 0
    });
  } catch (error) {
    console.error('❌ Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update appointment (payment settlement, status updates, etc)
app.put('/api/appointments/:id', async (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const { id } = req.params;
  const {
    payment_status,
    payment_method,
    down_payment,
    cash_payment,
    bank_transfer,
    expenses,
    discount_type,
    discount_value,
    price_before_discount,
    payment_reference,
    notes,
    staff
  } = req.body;

  try {
    const updateFields = [];
    const updateParams = [];

    if (payment_status !== undefined) {
      updateFields.push('payment_status = ?');
      updateParams.push(payment_status);
    }
    if (payment_method !== undefined) {
      updateFields.push('payment_method = ?');
      updateParams.push(payment_method);
    }
    if (down_payment !== undefined) {
      updateFields.push('down_payment = ?');
      updateParams.push(down_payment);
    }
    if (cash_payment !== undefined) {
      updateFields.push('cash_payment = ?');
      updateParams.push(cash_payment);
    }
    if (bank_transfer !== undefined) {
      updateFields.push('bank_transfer = ?');
      updateParams.push(bank_transfer);
    }
    if (expenses !== undefined) {
      updateFields.push('expenses = ?');
      updateParams.push(expenses);
    }
    if (discount_type !== undefined) {
      updateFields.push('discount_type = ?');
      updateParams.push(discount_type);
    }
    if (discount_value !== undefined) {
      updateFields.push('discount_value = ?');
      updateParams.push(discount_value);
    }
    if (price_before_discount !== undefined) {
      updateFields.push('price_before_discount = ?');
      updateParams.push(price_before_discount);
    }
    if (payment_reference !== undefined) {
      updateFields.push('payment_reference = ?');
      updateParams.push(payment_reference);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }
    if (staff !== undefined) {
      updateFields.push('staff = ?');
      updateParams.push(staff);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateParams.push(id);

    const updateQuery = `UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`;

    await new Promise((resolve, reject) => {
      sqliteDb.run(updateQuery, updateParams, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`✅ Appointment ${id} updated`);

    res.json({
      success: true,
      id: parseInt(id),
      message: 'Appointment updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Employees management endpoints
app.get('/api/employees', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const includeArchived = req.query.includeArchived === 'true';
  const whereClause = includeArchived ? '' : 'WHERE is_deleted = 0';

  sqliteDb.all(`SELECT * FROM employees ${whereClause} ORDER BY name`, [], (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }

    res.json(employees || []);
  });
});

// Time tracking endpoints
app.post('/api/timetracking/clockin', (req, res) => {
  const { employeeId, timestamp } = req.body;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const today = new Date().toISOString().split('T')[0];

  sqliteDb.run(
    'INSERT INTO time_entries (employee_id, date, clock_in, status) VALUES (?, ?, ?, ?)',
    [employeeId, today, timestamp || new Date().toISOString(), 'on-time'],
    function(err) {
      if (err) {
        console.error('Error recording clock in:', err);
        return res.status(500).json({ error: 'Failed to record clock in' });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.post('/api/timetracking/clockout', (req, res) => {
  const { employeeId, timestamp } = req.body;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const today = new Date().toISOString().split('T')[0];

  sqliteDb.run(
    'UPDATE time_entries SET clock_out = ? WHERE employee_id = ? AND date = ? AND clock_out IS NULL',
    [timestamp || new Date().toISOString(), employeeId, today],
    function(err) {
      if (err) {
        console.error('Error recording clock out:', err);
        return res.status(500).json({ error: 'Failed to record clock out' });
      }

      res.json({ success: true, changes: this.changes });
    }
  );
});

// Get active time tracking sessions
app.get('/api/timetracking/active', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const today = new Date().toISOString().split('T')[0];

  sqliteDb.all(`
    SELECT te.*, e.name as employee_name, e.email as employee_email
    FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    WHERE te.date = ? AND te.clock_out IS NULL
  `, [today], (err, rows) => {
    if (err) {
      console.error('Error fetching active sessions:', err);
      return res.status(500).json({ error: 'Failed to fetch active sessions' });
    }

    res.json(rows || []);
  });
});

// Get today's time tracking entries
app.get('/api/timetracking/today', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const today = new Date().toISOString().split('T')[0];

  sqliteDb.all(`
    SELECT te.*, e.name as employee_name, e.email as employee_email, e.avatar as employee_avatar
    FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    WHERE te.date = ?
    ORDER BY COALESCE(te.clock_out, te.clock_in) DESC
  `, [today], (err, rows) => {
    if (err) {
      console.error('Error fetching today\'s time entries:', err);
      return res.status(500).json({ error: 'Failed to fetch today\'s entries' });
    }
    res.json(rows || []);
  });
});

// Get recent time tracking events
app.get('/api/timetracking/recent', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const limit = parseInt(req.query.limit) || 10;
  const days = parseInt(req.query.days) || 1;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  const start = startDate.toISOString().split('T')[0];
  const end = today.toISOString().split('T')[0];

  sqliteDb.all(`
    SELECT te.*, e.name as employee_name, e.email as employee_email, e.avatar as employee_avatar
    FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    WHERE te.date BETWEEN ? AND ?
    ORDER BY COALESCE(te.clock_out, te.clock_in) DESC
    LIMIT ?
  `, [start, end, limit], (err, rows) => {
    if (err) {
      console.error('Error fetching recent time entries:', err);
      return res.status(500).json({ error: 'Failed to fetch recent entries' });
    }
    res.json(rows || []);
  });
});

// Employee management endpoints
app.post('/api/employees', (req, res) => {
  const { name, email, position, status, avatar } = req.body;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.run(
    'INSERT INTO employees (name, email, position, status, avatar) VALUES (?, ?, ?, ?, ?)',
    [name, email, position, status || 'active', avatar],
    function(err) {
      if (err) {
        console.error('Error creating employee:', err);
        return res.status(500).json({ error: 'Failed to create employee' });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, position, status, avatar } = req.body;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.run(
    'UPDATE employees SET name = ?, email = ?, position = ?, status = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, email, position, status, avatar, id],
    function(err) {
      if (err) {
        console.error('Error updating employee:', err);
        return res.status(500).json({ error: 'Failed to update employee' });
      }

      res.json({ success: true, changes: this.changes });
    }
  );
});

app.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  console.log(`���️ DELETE request for employee ID: ${id} (type: ${typeof id})`);

  if (!sqliteConnected) {
    console.error('❌ Database not connected for employee deletion');
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.run(
    'UPDATE employees SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error archiving employee:', err);
        return res.status(500).json({ error: 'Failed to archive employee' });
      }

      console.log('Employee archived successfully. Changes: ' + this.changes);

      if (this.changes === 0) {
        console.warn('Archive operation reported 0 changes');
        return res.status(404).json({ error: 'Employee not found during archival' });
      }

      res.json({ success: true, message: 'Employee archived successfully', archived: this.changes });
    }
  );
});

// Get archived employees
app.get('/api/employees/archived', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.all('SELECT * FROM employees WHERE is_deleted = 1 ORDER BY deleted_at DESC', [], (err, employees) => {
    if (err) {
      console.error('Error fetching archived employees:', err);
      return res.status(500).json({ error: 'Failed to fetch archived employees' });
    }

    res.json(employees || []);
  });
});

// Permanently delete archived employee (after retention period)
app.delete('/api/employees/:id/permanent', (req, res) => {
  const { id } = req.params;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.run(
    'DELETE FROM employees WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error permanently deleting employee:', err);
        return res.status(500).json({ error: 'Failed to permanently delete employee' });
      }

      console.log('Employee permanently deleted. Changes: ' + this.changes);

      res.json({ success: true, message: 'Employee permanently deleted', permanentlyDeleted: this.changes });
    }
  );
});

// Send login credentials email endpoint
app.post('/api/send-credentials-email', async (req, res) => {
  const { email, name, username, password, role } = req.body;

  // Validate required fields
  if (!email || !name || !username || !password) {
    return res.status(400).json({
      error: 'Missing required fields: email, name, username, and password are required'
    });
  }

  try {
    // Create HTML email template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .credentials-box {
            background-color: #f3f4f6;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
          }
          .credentials-box p {
            margin: 10px 0;
            font-size: 14px;
          }
          .credentials-box label {
            display: block;
            font-weight: bold;
            color: #374151;
            margin-top: 10px;
            margin-bottom: 5px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .credentials-box .value {
            background-color: white;
            padding: 10px;
            border-radius: 4px;
            word-break: break-all;
            font-size: 15px;
            color: #1f2937;
          }
          .button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            margin-top: 30px;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #92400e;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Login Credentials</h1>
            <p>Your account has been set up in Ink and Arch</p>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>

            <p>Welcome to <strong>Ink and Arch</strong>! Your employee account has been created with ${role} access. Below are your login credentials:</p>

            <div class="credentials-box">
              <label>Username</label>
              <div class="value">${username}</div>

              <label>Password</label>
              <div class="value">${password}</div>

              <label>Role</label>
              <div class="value">${role}</div>
            </div>

            <div class="warning">
              ⚠️ <strong>Security Notice:</strong> Please keep your credentials confidential. Change your password after your first login for security purposes.
            </div>

            <p style="margin-top: 30px;">To access your account, visit the Ink and Arch login page and enter your username and password.</p>

            <p>If you have any questions or need assistance, please contact your administrator.</p>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Best regards,<br>
              <strong>Ink and Arch Team</strong>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Ink and Arch. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER || 'noreply@inkandarch.com',
      to: email,
      subject: 'Your Ink and Arch Login Credentials',
      html: htmlTemplate,
      text: `Hello ${name},\n\nYour Ink and Arch account has been created.\n\nUsername: ${username}\nPassword: ${password}\nRole: ${role}\n\nPlease keep your credentials confidential and change your password after first login.\n\nBest regards,\nInk and Arch Team`
    });

    console.log(`✅ Credentials email sent successfully to: ${email}`);

    res.json({
      success: true,
      message: 'Credentials email sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending credentials email:', error);

    // Provide helpful error message
    let errorMessage = 'Failed to send email';
    if (error.message.includes('Invalid login')) {
      errorMessage = 'Email service not configured. Please contact administrator.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Email service connection failed. Please try again later.';
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message
    });
  }
});

// Inventory management endpoints
app.get('/api/inventory', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.all('SELECT * FROM inventory ORDER BY name', [], (err, items) => {
    if (err) {
      console.error('Error fetching inventory:', err);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }

    res.json(items || []);
  });
});

app.post('/api/inventory', (req, res) => {
  const body = req.body || {};

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  // Build insert dynamically based on available columns
  sqliteDb.all("PRAGMA table_info(inventory)", [], (err, columns) => {
    if (err) {
      console.error('Error checking inventory table structure:', err);
      return res.status(500).json({ error: 'Database structure error' });
    }

    const available = new Set(columns.map(c => c.name));
    const baseFields = ['name','category','quantity','min_quantity','unit','description'];
    const optionalFields = ['expiry_date','supplier','platform','purchase_cost','date_received'];

    const fields = baseFields.filter(f => available.has(f)).concat(optionalFields.filter(f => available.has(f)));
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => {
      const v = body[f];
      if (f === 'quantity' || f === 'min_quantity') return Number(v) || 0;
      if (f === 'purchase_cost') return v == null ? 0 : Number(v);
      return v ?? null;
    });

    const insertQuery = `INSERT INTO inventory (${fields.join(', ')}) VALUES (${placeholders})`;

    sqliteDb.run(insertQuery, values, function(err) {
      if (err) {
        console.error('Error creating inventory item:', err);
        return res.status(500).json({ error: 'Failed to create inventory item' });
      }
      res.json({ success: true, id: this.lastID });
    });
  });
});

app.put('/api/inventory/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  // Build update dynamically
  sqliteDb.all("PRAGMA table_info(inventory)", [], (err, columns) => {
    if (err) {
      console.error('Error checking inventory table structure:', err);
      return res.status(500).json({ error: 'Database structure error' });
    }

    const available = new Set(columns.map(c => c.name));
    const updatable = ['name','category','quantity','min_quantity','unit','description','expiry_date','supplier','platform','purchase_cost','date_received'];
    const sets = [];
    const values = [];

    updatable.forEach(f => {
      if (available.has(f) && Object.prototype.hasOwnProperty.call(body, f)) {
        sets.push(`${f} = ?`);
        if (f === 'quantity' || f === 'min_quantity') values.push(Number(body[f]) || 0);
        else if (f === 'purchase_cost') values.push(body[f] == null ? 0 : Number(body[f]));
        else values.push(body[f] ?? null);
      }
    });

    if (available.has('last_updated')) {
      sets.push('last_updated = CURRENT_TIMESTAMP');
    }

    if (sets.length === 0) {
      return res.json({ success: true, changes: 0 });
    }

    const updateQuery = `UPDATE inventory SET ${sets.join(', ')} WHERE id = ?`;
    values.push(id);

    sqliteDb.run(updateQuery, values, function(err) {
      if (err) {
        console.error('Error updating inventory item:', err);
        return res.status(500).json({ error: 'Failed to update inventory item' });
      }

      res.json({ success: true, changes: this.changes });
    });
  });
});

app.delete('/api/inventory/:id', (req, res) => {
  const { id } = req.params;

  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  // Actually delete the item from the database
  sqliteDb.run(
    'DELETE FROM inventory WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error deleting inventory item:', err);
        return res.status(500).json({ error: 'Failed to delete inventory item' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      res.json({ success: true, message: 'Inventory item deleted successfully' });
    }
  );
});

// Appointments endpoints
app.get('/api/appointments', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  sqliteDb.all('SELECT * FROM appointments ORDER BY date DESC', [], (err, appointments) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }

    res.json(appointments || []);
  });
});

// Get archived employees (BEFORE catch-all route)
app.get('/api/sqlite/employees/archive/list', (req, res) => {
  if (!sqliteConnected) {
    return res.status(500).json({ error: 'SQLite not connected' });
  }

  sqliteDb.all('SELECT * FROM employee_archive ORDER BY archived_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Generic data endpoints for both databases
app.get('/api/:dbType/:collection', async (req, res) => {
  const { dbType, collection } = req.params;

  try {
    if (dbType === 'mongodb' && mongoConnected) {
      const db = mongoClient.db(DB_NAME);
      // Map collection names to document types
      const typeMapping = {
        'employees': 'employee',
        'users': 'user',
        'time_entries': 'time_entry',
        'patients': 'patient',
        'inventory': 'inventory_item',
        'appointments': 'appointment'
      };
      const documentType = typeMapping[collection] || collection;
      const data = await db.collection('inkandarchdata').find({ type: documentType }).toArray();
      res.json(data);
    } else if (dbType === 'sqlite' && sqliteConnected) {
      const tableName = collection.toLowerCase();
      sqliteDb.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json(rows);
        }
      });
    } else {
      res.status(500).json({ error: 'Database not connected' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📁 Serving static files from public directory');
  console.log('🔌 Initializing database connections...');
  
  await initializeDatabases();
  
  console.log('\n📊 Database Status:');
  console.log(`   MongoDB Atlas: ${mongoConnected ? '✅ Connected' : '��� Disconnected'}`);
  console.log(`   SQLite Local:  ${sqliteConnected ? '✅ Connected' : '❌ Disconnected'}`);
  console.log('\n🌐 Available endpoints:');
  console.log(`   Health Check:  http://localhost:${PORT}/api/health`);
  console.log(`   Frontend App:  http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');

  // Create final backup before shutdown
  if (sqliteConnected) {
    console.log('📦 Creating final backup before shutdown...');
    await backupDatabase();
  }

  if (mongoConnected) {
    await mongoClient.close();
    console.log('✅ MongoDB connection closed');
  }

  if (sqliteDb) {
    sqliteDb.close((err) => {
      if (err) {
        console.error('❌ Error closing SQLite:', err);
      } else {
        console.log('✅ SQLite connection closed');
      }
    });
  }

  process.exit(0);
});

// Handle graceful shutdown with final backup
process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  if (sqliteConnected) {
    console.log('📦 Creating final restore point before shutdown...');
    await createRestorePoint();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⛔ Received SIGINT, shutting down gracefully...');
  if (sqliteConnected) {
    console.log('📦 Creating final restore point before shutdown...');
    await createRestorePoint();
  }
  process.exit(0);
});

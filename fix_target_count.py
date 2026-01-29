#!/usr/bin/env python3
"""Fix target_count NULL values in Docker databases"""
import pymssql

FACTORIES = [
    {"name": "China", "host": "localhost", "port": 1433},
    {"name": "Korea", "host": "localhost", "port": 1435},
    {"name": "Vietnam", "host": "localhost", "port": 1434},
]

PASSWORD = "DockerTest123!"

for factory in FACTORIES:
    print(f"\n🔧 Fixing {factory['name']}...")
    try:
        conn = pymssql.connect(
            server=factory['host'],
            port=factory['port'],
            user='sa',
            password=PASSWORD,
            database='SherlockSky',
            autocommit=True
        )
        cursor = conn.cursor()
        
        # Update NULL target_count to default value (100)
        cursor.execute("""
            UPDATE core.Equipment 
            SET target_count = 100 
            WHERE target_count IS NULL
        """)
        updated = cursor.rowcount
        
        # Also update NULL production_count to 0
        cursor.execute("""
            UPDATE core.Equipment 
            SET production_count = 0 
            WHERE production_count IS NULL
        """)
        
        # Also update NULL tact_time to 0
        cursor.execute("""
            UPDATE core.Equipment 
            SET tact_time = 0.0 
            WHERE tact_time IS NULL
        """)
        
        # Verify
        cursor.execute("SELECT COUNT(*) FROM core.Equipment WHERE target_count IS NULL")
        null_count = cursor.fetchone()[0]
        
        conn.close()
        print(f"  ✅ Updated {updated} rows, remaining NULL: {null_count}")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n✅ All factories fixed!")
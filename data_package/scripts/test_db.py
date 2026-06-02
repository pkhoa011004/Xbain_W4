import sqlite3

conn = sqlite3.connect("geekbrain.db")

cursor = conn.cursor()

cursor.execute("""
SELECT service,
       SUM(total_cost)
FROM monthly_costs
WHERE service='PaymentGW'
AND month IN (
'2026-01',
'2026-02',
'2026-03'
)
""")

rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()
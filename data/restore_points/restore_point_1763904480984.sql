-- SQLite Database Restore Point
-- Created: 2025-11-23T13:28:00.984Z

-- Table: users
DROP TABLE IF EXISTS users;
CREATE TABLE users (
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
    );
INSERT INTO users (id, username, email, password, role, first_name, last_name, status, created_at, updated_at) VALUES
  ('1', 'admin123', 'admin123@inkandarch.com', 'admin123', 'admin', 'Admin', 'User', 'active', '2025-08-03 13:27:30', '2025-08-03 13:27:30'),
  ('2', 'frontdesk123', 'frontdesk123@inkandarch.com', 'password123', 'front_desk', 'Front', 'Desk', 'active', '2025-08-03 13:27:30', '2025-08-03 13:27:30'),
  ('3', 'employee123', 'employee123@inkandarch.com', 'employee123', 'employee', 'Employee', 'User', 'active', '2025-08-03 13:27:30', '2025-08-03 13:27:30'),
  ('58', 'employee2', 'employee2@email.com', 'employee2', 'admin', 'test', 'employee2', 'active', '2025-08-07 19:17:29', '2025-08-07 19:17:29'),
  ('65', 'employee1', 'employee1@email.com', 'employee1', 'front_desk', 'test', 'employee1', 'active', '2025-08-07 19:26:31', '2025-08-07 19:26:31'),
  ('84', 'test123', 'test123@email.com', 'test123', 'employee', 'test', '123', 'active', '2025-08-11 14:07:32', '2025-08-11 14:07:32'),
  ('118', 'employee3', 'employee3@email.com', 'employee3', 'employee', 'test', 'employee3', 'active', '2025-08-11 16:37:47', '2025-08-11 16:37:47'),
  ('206', 'kmangoltad132', 'kmangoltad132@gmail.com', 'password123', 'admin', 'Karl', 'Kevin', 'active', '2025-09-23 15:48:36', '2025-09-23 15:48:36'),
  ('324', 'sample', 'sample@email.com', 'password123', 'front_desk', 'Karl', 'Kevin', 'active', '2025-10-25 13:11:05', '2025-10-25 13:11:05'),
  ('376', 'kkjmangoltad132', 'kkjmangoltad132@gmail.com', 'firebull123', 'front_desk', 'Karl', 'James', 'active', '2025-10-27 16:33:28', '2025-10-27 16:33:28'),
  ('383', 'fdemp', 'fdemp@email.com', 'frontdesk123', 'front_desk', 'Fd', 'Employee', 'active', '2025-10-28 00:51:50', '2025-10-28 00:51:50');

-- Table: employees
DROP TABLE IF EXISTS employees;
CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      position TEXT,
      status TEXT DEFAULT 'active',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , deleted_at DATETIME, is_deleted INTEGER DEFAULT 0);
INSERT INTO employees (id, name, email, position, status, avatar, created_at, updated_at, deleted_at, is_deleted) VALUES
  ('1', 'Admin User', 'admin123@inkandarch.com', 'Administrator', 'active', 'data:image/svg+xml;base64,CiAgICA8c3ZnIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPGNpcmNsZSBjeD0iNzUiIGN5PSI3NSIgcj0iNzUiIGZpbGw9IiMwNkI2RDQiLz4KICAgICAgPHRleHQgeD0iNzUiIHk9Ijg1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIgogICAgICAgICAgICB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+QVU8L3RleHQ+CiAgICA8L3N2Zz4KICA=', '2025-08-03 13:41:51', '2025-08-03 13:41:51', NULL, '0'),
  ('2', 'Employee User', 'employee123@inkandarch.com', 'Employee', 'active', 'data:image/svg+xml;base64,CiAgICA8c3ZnIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPGNpcmNsZSBjeD0iNzUiIGN5PSI3NSIgcj0iNzUiIGZpbGw9IiM2MzY2RjEiLz4KICAgICAgPHRleHQgeD0iNzUiIHk9Ijg1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIgogICAgICAgICAgICB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+RVU8L3RleHQ+CiAgICA8L3N2Zz4KICA=', '2025-08-03 13:41:51', '2025-08-03 13:41:51', NULL, '0'),
  ('3', 'Front Desk', 'frontdesk123@inkandarch.com', 'Front Desk', 'active', 'data:image/svg+xml;base64,CiAgICA8c3ZnIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPGNpcmNsZSBjeD0iNzUiIGN5PSI3NSIgcj0iNzUiIGZpbGw9IiMzQjgyRjYiLz4KICAgICAgPHRleHQgeD0iNzUiIHk9Ijg1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIgogICAgICAgICAgICB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+RkQ8L3RleHQ+CiAgICA8L3N2Zz4KICA=', '2025-08-03 13:41:51', '2025-08-03 13:41:51', NULL, '0'),
  ('53', 'test employee2', 'employee2@email.com', 'admin', 'active', 'data:image/svg+xml;base64,CiAgICA8c3ZnIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPGNpcmNsZSBjeD0iNzUiIGN5PSI3NSIgcj0iNzUiIGZpbGw9IiM4QjVDRjYiLz4KICAgICAgPHRleHQgeD0iNzUiIHk9Ijg1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIgogICAgICAgICAgICB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+VEU8L3RleHQ+CiAgICA8L3N2Zz4KICA=', '2025-08-07 19:17:29', '2025-08-07 19:17:29', NULL, '0'),
  ('61', 'test employee1', 'employee1@email.com', 'frontdesk', 'active', 'data:image/svg+xml;base64,CiAgICA8c3ZnIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPGNpcmNsZSBjeD0iNzUiIGN5PSI3NSIgcj0iNzUiIGZpbGw9IiM4QjVDRjYiLz4KICAgICAgPHRleHQgeD0iNzUiIHk9Ijg1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSJib2xkIgogICAgICAgICAgICB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSI+VEU8L3RleHQ+CiAgICA8L3N2Zz4KICA=', '2025-08-07 19:26:31', '2025-08-07 19:26:31', NULL, '0'),
  ('80', 'test 123', 'test123@email.com', 'employee', 'active', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAEjklEQVR4Xu3bP49UZRjG4XfZP0IihVQaSwnQYGMgsdBoTEzUxJJIYiigoKOS0i8glR/AQrAyNBY2JtjYGIIx0cJCEy2toJAYYHcZWBMMmmV4n9lzz5ndXNTvuWf2d66cgdmwdOnDvyfNHwUGLrAE1sBFzf1TACwQIgXAimQ1ChYDkQJgRbIaBYuBSAGwIlmNgsVApABYkaxGwWIgUgCsSFajYDEQKQBWJKtRsBiIFAArktUoWAxECoAVyWoULAYiBcCKZDUKFgORAmBFshoFi4FIAbAiWY2CxUCkAFiRrEbBYiBSAKxIVqNgMRApAFYkq1GwGIgUACuS1ShYDEQKgBXJahQsBiIFwIpkNQoWA5ECYEWyGgWLgUgBsCJZjYLFQKQAWJGsRsFiIFIArEhWo2AxECkAViSrUbAYiBQAK5LVKFgMRAqAFclqdNfAOndpf3vu+aXR79ivNzbbV5/e29H7ePnNlfb22dVtN279OWmfXbyzo/1FuBis4l0YAtbpj59pLx7ZB1axfeT4XnliTXtabYXzxIrwefLoXoD1wkv72vsX1trBQ0/+SAcLrHKBaR+Bj8bAKmfd2QW7/YnVg8pH4c6MzHT1bobViwqsmWjM/6KPrhyY+qLpj53Dryy3t86sTv071f/fYPo9zesu7JqvG2YJMiasd86vtaMnl9vKWu2dg1XrNcrpMWCdfG+lHX9jZeYvc8EahUrtRecJ67VTq+3IieWZQflXYe3ejnp6XrC2nlKvf7D9r2iqATyxqsVGOL9osDYe/opx496k7X/WF6QjcBjuJRcJ1haqb79Ybyfenf73L0+s4e5/bGlRYP11c9KuXV5vv/2w2Z72fRxYMQ7DDS8CrD9+vt+ufnL33x8KrOHu72hLY8Laekr9+M1Gu/71xn9+frBG4zDcC48B687tSfvl+8127fP1bX8QsIa7v6MtzRPWsVeX2+8/3W/ffbk9qEcRwBqNw3AvPC9YlXcMVqXWgp4Fa7wb45fQc/6PC55Y42Ef7JU9sQZLWR7yxPLEKqPpuQAssHqclM+ABVYZTc8FYIHV46R8Biywymh6LgALrB4n5TNggVVG03MBWGD1OCmfAQusMpqeC8ACq8dJ+QxYYJXR9FwAFlg9TspnwAKrjKbnArDA6nFSPgMWWGU0PReABVaPk/IZsMAqo+m5ACywepyUz4AFVhlNzwVggdXjpHxmT8Mq13DBYAXAGiyloccLgMVDpABYkaxGwWIgUgCsSFajYDEQKQBWJKtRsBiIFAArktUoWAxECoAVyWoULAYiBcCKZDUKFgORAmBFshoFi4FIAbAiWY2CxUCkAFiRrEbBYiBSAKxIVqNgMRApAFYkq1GwGIgUACuS1ShYDEQKgBXJahQsBiIFwIpkNQoWA5ECYEWyGgWLgUgBsCJZjYLFQKQAWJGsRsFiIFIArEhWo2AxECkAViSrUbAYiBQAK5LVKFgMRAqAFclqFCwGIgXAimQ1ChYDkQJgRbIaBYuBSAGwIlmNgsVApABYkaxGwWIgUgCsSFajYDEQKQBWJKtRsBiIFHgAagTirLzyGsQAAAAASUVORK5CYII=', '2025-08-11 14:07:32', '2025-08-11 14:07:32', NULL, '0'),
  ('114', 'test employee3', 'employee3@email.com', 'employee', 'active', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAETklEQVR4Xu3aoW4VURCH8a0BhyKpwmAwKF4Ex4vgeAAcL4LDFM8DoIogTTCoJigSDKYkkEAoac/ZuTvTLfOrPuc/d775Orvp7dGdk9OLxQ8CGxM4ItbGRMX9JEAsIqQQIFYKVqHE4kAKAWKlYBVKLA6kECBWClahxOJACgFipWAVSiwOpBAgVgpWocTiQAoBYqVgFUosDqQQIFYKVqHE4kAKAWKlYBVKLA6kECBWClahxOJACgFipWAVSiwOpBAgVgpWocTiQAoBYqVgFUosDqQQIFYKVqHE4kAKAWKlYBVKLA6kECBWClahxOJACgFipWAVSiwOpBAgVgpWocTiQAoBYqVgFUosDqQQIFYKVqHE4kAKAWKlYBVKLA6kECBWClahxOJACgFipWAVSiwOpBAgVgpWocTiQAoBYqVgFbpbsZ4/vL+8fHS8iwndffvhr89x05/t7Nv35fG7s12wuepDEGtiPMSagHTpCLEmmBFrAhKx1kMi1npmNtYEM2JNQLKx1kMi1npmNtYEM2JNQLotG2t9K8vy+smD5enxvWuvvvh4vrz69CUS//vOzJ8b3px/XZ69/3xQndt8ebcbKwKVWBFqOXeIFeBqY42hEWvM6J8TxBpDI9aYEbECjIgVgGZjjaERa8zIxgowIlYAmo01hkasMSMbK8CIWAFoNtYYGrHGjEIbKxA7deXy10tTl27gELEC0Gc2ViB26gqxpjBte2hPX+ls29mfNGJlkb0ml1g3AP2Kkh6FgVl4FI6hEWvMyMt7gBGxAtBsrDE0Yo0ZhTaWf/Q7Ob0IsN3llT29vBOLWKt/SWYehcQiFrFWExhf8I41ZuQdK8CIWAFoHoVjaMQaM7KxAoyIFYBmY42hEWvMyMYKMCJWAJqNNYZGrDEjGyvAiFgBaDbWGBqxxoxCGysQu+rK3v+yT6xV4/x1eGZjBWJXXSHWKlyHHd7Tl9CHdTK+Tawxo81OEGszlAcHeRQGEHoUjqERa8zIy3uAEbEC0GysMbT/Sqxxu05UESBWFelmdYjVbOBV7RKrinSzOsRqNvCqdolVRbpZHWI1G3hVu8SqIt2sDrGaDbyqXWJVkW5Wh1jNBl7VLrGqSDerQ6xmA69ql1hVpJvVIVazgVe1S6wq0s3qEKvZwKvaJVYV6WZ1iNVs4FXtEquKdLM6xGo28Kp2iVVFulkdYjUbeFW7xKoi3awOsZoNvKpdYlWRblaHWM0GXtUusapIN6tDrGYDr2qXWFWkm9UhVrOBV7VLrCrSzeoQq9nAq9olVhXpZnWI1WzgVe0Sq4p0szrEajbwqnaJVUW6WR1iNRt4VbvEqiLdrA6xmg28ql1iVZFuVodYzQZe1S6xqkg3q0OsZgOvapdYVaSb1SFWs4FXtUusKtLN6hCr2cCr2iVWFelmdYjVbOBV7RKrinSzOsRqNvCqdolVRbpZHWI1G3hVu8SqIt2sDrGaDbyq3R+LbVqOuOEGZQAAAABJRU5ErkJggg==', '2025-08-11 16:37:46', '2025-08-11 16:37:46', NULL, '0'),
  ('202', 'Karl Kevin James Mangoltad', 'kmangoltad132@gmail.com', 'admin', 'active', 'data:image/png;base64,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', '2025-09-23 15:48:36', '2025-09-23 15:48:36', NULL, '0'),
  ('320', 'Karl Kevin', 'sample@email.com', 'frontdesk', 'active', 'data:image/png;base64,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', '2025-10-25 13:11:05', '2025-10-25 13:11:05', '2025-11-18 13:08:31', '1'),
  ('379', 'Sample Empl', 'samp@email.com', 'admin', 'active', NULL, '2025-10-28 00:40:26', '2025-10-28 00:40:43', NULL, '0'),
  ('380', 'Fd Employee', 'fdemp@email.com', 'Front', 'active', 'data:image/png;base64,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', '2025-10-28 00:51:49', '2025-10-28 00:51:49', NULL, '0');

-- Table: time_entries
DROP TABLE IF EXISTS time_entries;
CREATE TABLE time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      clock_in DATETIME,
      clock_out DATETIME,
      date TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    );
INSERT INTO time_entries (id, employee_id, clock_in, clock_out, date, status) VALUES
  ('1', '1', '2025-08-07T19:11:29.813Z', '2025-08-07T19:11:33.635Z', '2025-08-07', 'on-time'),
  ('2', '1', '2025-08-07T19:11:34.367Z', '2025-08-07T19:11:35.049Z', '2025-08-07', 'on-time'),
  ('3', '1', '2025-08-07T19:11:35.711Z', '2025-08-07T19:11:36.274Z', '2025-08-07', 'on-time'),
  ('4', '61', '2025-08-07T19:37:44.549Z', '2025-08-07T19:37:48.242Z', '2025-08-07', 'on-time'),
  ('5', '61', '2025-08-07T19:37:49.153Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('6', '61', '2025-08-07T19:41:48.887Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('7', '61', '2025-08-07T19:41:55.067Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('8', '61', '2025-08-07T19:48:07.079Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('9', '53', '2025-08-07T19:48:09.622Z', '2025-08-07T19:54:19.779Z', '2025-08-07', 'on-time'),
  ('10', '61', '2025-08-07T19:48:37.449Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('11', '61', '2025-08-07T19:48:45.603Z', '2025-08-07T19:54:21.855Z', '2025-08-07', 'on-time'),
  ('12', '61', '2025-08-07T19:54:41.189Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('13', '61', '2025-08-07T19:54:44.801Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('14', '61', '2025-08-07T19:54:45.975Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('15', '61', '2025-08-07T19:54:46.987Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('16', '61', '2025-08-07T19:54:48.171Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('17', '61', '2025-08-07T19:54:49.323Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('18', '61', '2025-08-07T19:54:50.355Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('19', '61', '2025-08-07T19:54:51.407Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('20', '61', '2025-08-07T19:54:52.409Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('21', '61', '2025-08-07T19:54:53.371Z', '2025-08-07T19:56:09.642Z', '2025-08-07', 'on-time'),
  ('22', '53', '2025-08-07T19:55:32.903Z', '2025-08-07T19:56:17.525Z', '2025-08-07', 'on-time'),
  ('23', '53', '2025-08-07T19:55:33.867Z', '2025-08-07T19:56:17.525Z', '2025-08-07', 'on-time'),
  ('24', '61', '2025-08-07T19:58:00.097Z', '2025-08-07T19:58:01.739Z', '2025-08-07', 'on-time'),
  ('25', '53', '2025-08-07T19:58:05.307Z', '2025-08-07T19:58:06.369Z', '2025-08-07', 'on-time'),
  ('26', '53', '2025-08-07T19:58:09.733Z', '2025-08-07T19:58:12.841Z', '2025-08-07', 'on-time'),
  ('27', '61', '2025-08-07T19:58:14.647Z', '2025-08-07T19:58:34.775Z', '2025-08-07', 'on-time'),
  ('28', '53', '2025-08-07T19:58:18.755Z', '2025-08-07T19:58:39.173Z', '2025-08-07', 'on-time'),
  ('29', '61', '2025-08-11T13:38:40.696Z', '2025-08-11T13:38:41.571Z', '2025-08-11', 'on-time'),
  ('30', '80', '2025-08-11T14:15:44.947Z', '2025-08-11T14:20:25.156Z', '2025-08-11', 'on-time'),
  ('31', '80', '2025-08-11T14:26:44.592Z', '2025-08-11T14:37:01.868Z', '2025-08-11', 'on-time'),
  ('32', '80', '2025-08-11T14:50:19.754Z', '2025-08-11T14:50:34.222Z', '2025-08-11', 'on-time'),
  ('33', '80', '2025-08-11T15:04:04.794Z', '2025-08-11T15:10:17.112Z', '2025-08-11', 'on-time'),
  ('34', '2', '2025-08-11T15:09:38.634Z', '2025-08-11T15:09:53.302Z', '2025-08-11', 'on-time'),
  ('35', '80', '2025-08-11T16:06:53.836Z', '2025-08-11T16:08:30.033Z', '2025-08-11', 'on-time'),
  ('36', '61', '2025-08-11T16:06:57.081Z', '2025-08-11T16:08:28.185Z', '2025-08-11', 'on-time'),
  ('37', '53', '2025-08-11T16:06:58.817Z', '2025-08-11T16:08:26.679Z', '2025-08-11', 'on-time'),
  ('38', '2', '2025-08-11T16:31:16.247Z', '2025-08-11T16:38:59.505Z', '2025-08-11', 'on-time'),
  ('39', '2', '2025-08-11T16:36:39.036Z', '2025-08-11T16:38:59.505Z', '2025-08-11', 'on-time'),
  ('40', '114', '2025-08-11T16:38:21.303Z', '2025-08-11T16:39:02.621Z', '2025-08-11', 'on-time'),
  ('41', '114', '2025-08-11T16:42:07.313Z', '2025-08-11T16:42:16.510Z', '2025-08-11', 'on-time'),
  ('42', '114', '2025-08-11T17:00:30.983Z', '2025-08-11T17:01:01.016Z', '2025-08-11', 'on-time'),
  ('43', '114', '2025-08-11T17:03:03.150Z', '2025-08-11T17:03:41.769Z', '2025-08-11', 'on-time'),
  ('44', '114', '2025-08-11T17:11:42.242Z', '2025-08-11T17:25:55.632Z', '2025-08-11', 'on-time'),
  ('45', '80', '2025-08-18T19:52:20.793Z', '2025-08-18T19:53:23.032Z', '2025-08-19', 'on-time'),
  ('46', '61', '2025-08-18T20:07:52.506Z', '2025-08-18T20:30:43.912Z', '2025-08-19', 'on-time'),
  ('47', '53', '2025-08-18T20:07:54.388Z', '2025-08-18T20:30:44.624Z', '2025-08-19', 'on-time'),
  ('48', '80', '2025-08-18T20:30:42.107Z', '2025-08-18T20:30:45.265Z', '2025-08-19', 'on-time'),
  ('49', '114', '2025-08-18T20:30:52.828Z', '2025-08-18T20:30:56.227Z', '2025-08-19', 'on-time'),
  ('50', '53', '2025-08-18T20:30:53.599Z', '2025-08-18T20:30:56.680Z', '2025-08-19', 'on-time'),
  ('51', '61', '2025-08-18T20:30:54.063Z', '2025-08-18T20:30:57.121Z', '2025-08-19', 'on-time'),
  ('52', '80', '2025-08-18T20:30:54.485Z', '2025-08-18T20:30:57.534Z', '2025-08-19', 'on-time'),
  ('53', '114', '2025-08-18T21:35:36.112Z', '2025-08-18T21:36:04.930Z', '2025-08-19', 'on-time'),
  ('54', '53', '2025-08-18T21:35:36.934Z', '2025-08-18T21:36:04.489Z', '2025-08-19', 'on-time'),
  ('55', '61', '2025-08-18T21:36:02.594Z', '2025-08-18T21:36:03.697Z', '2025-08-19', 'on-time'),
  ('56', '61', '2025-09-14T09:09:19.899Z', '2025-09-14T09:10:25.783Z', '2025-09-14', 'on-time'),
  ('57', '80', '2025-09-14T09:10:23.547Z', '2025-09-14T09:10:25.110Z', '2025-09-14', 'on-time'),
  ('58', '2', '2025-09-14T13:29:06.356Z', '2025-09-14T13:29:13.708Z', '2025-09-15', 'on-time'),
  ('59', '3', '2025-09-14T13:29:07.148Z', '2025-09-14T13:29:14.090Z', '2025-09-15', 'on-time'),
  ('60', '1', '2025-09-14T13:29:12.394Z', '2025-09-14T13:29:18.746Z', '2025-09-15', 'on-time'),
  ('61', '61', '2025-09-14T13:29:17.342Z', '2025-09-14T13:29:18.234Z', '2025-09-15', 'on-time'),
  ('62', '1', '2025-09-15T15:46:06.185Z', '2025-09-15T15:46:09.349Z', '2025-09-16', 'on-time'),
  ('63', '53', '2025-09-15T15:58:50.490Z', '2025-09-15T15:58:53.644Z', '2025-09-16', 'on-time'),
  ('64', '80', '2025-09-16T14:33:25.898Z', '2025-09-16T14:33:27.410Z', '2025-09-16', 'on-time'),
  ('65', '114', '2025-09-16T14:39:27.864Z', '2025-09-16T14:39:58.351Z', '2025-09-16', 'on-time'),
  ('66', '2', '2025-09-19T11:38:22.295Z', '2025-09-19T11:38:24.256Z', '2025-09-19', 'on-time'),
  ('67', '3', '2025-09-19T11:38:22.749Z', '2025-09-19T11:38:23.541Z', '2025-09-19', 'on-time'),
  ('68', '2', '2025-09-19T11:38:27.877Z', NULL, '2025-09-19', 'on-time'),
  ('69', '3', '2025-09-19T11:38:29.201Z', NULL, '2025-09-19', 'on-time'),
  ('70', '2', '2025-09-22T14:32:30.927Z', '2025-09-22T14:32:39.376Z', '2025-09-23', 'on-time'),
  ('71', '1', '2025-10-02T13:19:52.897Z', '2025-10-02T13:19:54.039Z', '2025-10-02', 'on-time'),
  ('72', '2', '2025-10-10T19:17:51.903Z', '2025-10-10T19:17:53.097Z', '2025-10-11', 'on-time'),
  ('73', '1', '2025-10-13T07:32:49.248Z', '2025-10-13T07:32:51.353Z', '2025-10-13', 'on-time'),
  ('74', '2', '2025-10-13T07:32:50.361Z', '2025-10-13T07:32:52.075Z', '2025-10-13', 'on-time'),
  ('75', '114', '2025-10-13T07:33:04.229Z', '2025-10-13T07:33:05.921Z', '2025-10-13', 'on-time'),
  ('76', '114', '2025-10-13T07:33:15.063Z', '2025-10-13T07:33:16.825Z', '2025-10-13', 'on-time'),
  ('77', '53', '2025-10-13T07:33:18.717Z', '2025-10-13T07:33:19.409Z', '2025-10-13', 'on-time'),
  ('78', '114', '2025-10-13T07:40:49.130Z', '2025-10-13T07:41:04.630Z', '2025-10-13', 'on-time'),
  ('79', '53', '2025-10-13T07:40:49.652Z', '2025-10-13T07:41:04.118Z', '2025-10-13', 'on-time'),
  ('80', '61', '2025-10-13T07:40:50.274Z', '2025-10-13T07:41:03.566Z', '2025-10-13', 'on-time'),
  ('81', '80', '2025-10-13T07:40:51.616Z', '2025-10-13T07:41:03.044Z', '2025-10-13', 'on-time'),
  ('82', '202', '2025-10-13T07:40:52.118Z', '2025-10-13T07:41:02.152Z', '2025-10-13', 'on-time'),
  ('83', '3', '2025-10-13T07:40:53.040Z', '2025-10-13T07:41:01.590Z', '2025-10-13', 'on-time'),
  ('84', '2', '2025-10-13T07:40:54.111Z', '2025-10-13T07:41:00.807Z', '2025-10-13', 'on-time'),
  ('85', '1', '2025-10-13T07:40:55.124Z', '2025-10-13T07:41:00.146Z', '2025-10-13', 'on-time'),
  ('86', '1', '2025-10-13T07:41:46.517Z', '2025-10-13T07:42:14.008Z', '2025-10-13', 'on-time'),
  ('87', '1', '2025-10-13T07:45:07.585Z', '2025-10-13T07:45:09.817Z', '2025-10-13', 'on-time'),
  ('88', '3', '2025-10-13T07:46:45.159Z', '2025-10-13T07:46:47.201Z', '2025-10-13', 'on-time'),
  ('89', '114', '2025-10-13T07:51:09.045Z', '2025-10-13T07:51:10.717Z', '2025-10-13', 'on-time'),
  ('90', '1', '2025-10-13T07:51:52.445Z', '2025-10-13T07:51:53.807Z', '2025-10-13', 'on-time'),
  ('91', '1', '2025-10-13T07:58:30.702Z', '2025-10-13T07:58:40.258Z', '2025-10-13', 'on-time'),
  ('92', '202', '2025-10-22T09:44:26.874Z', '2025-10-22T09:57:34.499Z', '2025-10-22', 'on-time'),
  ('93', '1', '2025-10-22T09:58:05.724Z', '2025-10-22T09:58:32.317Z', '2025-10-22', 'on-time'),
  ('94', '114', '2025-10-22T10:06:53.980Z', '2025-10-22T10:07:05.387Z', '2025-10-22', 'on-time'),
  ('95', '53', '2025-10-22T10:06:54.442Z', '2025-10-22T10:07:06.130Z', '2025-10-22', 'on-time'),
  ('96', '202', '2025-10-25T13:12:30.558Z', '2025-10-25T13:13:15.394Z', '2025-10-25', 'on-time'),
  ('97', '372', '2025-10-27T16:37:10.096Z', '2025-10-27T16:38:50.330Z', '2025-10-27', 'on-time'),
  ('98', '61', '2025-10-27T16:38:40.040Z', '2025-10-27T16:38:54.947Z', '2025-10-27', 'on-time'),
  ('99', '372', '2025-10-27T16:42:55.757Z', '2025-10-27T16:42:57.428Z', '2025-10-27', 'on-time'),
  ('100', '320', '2025-10-27T16:42:57.960Z', '2025-10-27T16:42:58.883Z', '2025-10-27', 'on-time'),
  ('101', '202', '2025-10-27T16:43:00.506Z', '2025-10-27T16:43:01.519Z', '2025-10-27', 'on-time'),
  ('102', '1', '2025-10-27T16:43:22.796Z', '2025-10-27T16:43:25.029Z', '2025-10-27', 'on-time'),
  ('103', '53', '2025-10-27T16:43:26.883Z', '2025-10-27T16:43:28.024Z', '2025-10-27', 'on-time'),
  ('104', '372', '2025-10-27T17:26:49.311Z', '2025-10-27T17:26:51.252Z', '2025-10-27', 'on-time'),
  ('105', '2', '2025-10-27T17:26:55.058Z', '2025-10-27T17:26:55.921Z', '2025-10-27', 'on-time'),
  ('106', '1', '2025-10-28T00:32:24.389Z', '2025-10-28T00:32:27.573Z', '2025-10-28', 'on-time'),
  ('107', '3', '2025-10-28T00:32:28.944Z', '2025-10-28T00:32:29.686Z', '2025-10-28', 'on-time'),
  ('108', '1', '2025-10-28T00:39:46.910Z', '2025-10-28T00:39:47.822Z', '2025-10-28', 'on-time'),
  ('109', '1', '2025-10-28T00:42:05.764Z', '2025-10-28T00:42:06.826Z', '2025-10-28', 'on-time'),
  ('110', '1', '2025-10-28T00:56:33.848Z', '2025-10-28T00:56:34.750Z', '2025-10-28', 'on-time'),
  ('111', '1', '2025-10-28T00:59:30.454Z', '2025-10-28T00:59:30.916Z', '2025-10-28', 'on-time'),
  ('112', '1', '2025-10-28T00:59:31.350Z', '2025-10-28T00:59:31.783Z', '2025-10-28', 'on-time'),
  ('113', '1', '2025-10-28T00:59:32.255Z', '2025-10-28T00:59:32.727Z', '2025-10-28', 'on-time'),
  ('114', '1', '2025-10-28T00:59:40.345Z', '2025-10-28T00:59:40.956Z', '2025-10-28', 'on-time'),
  ('115', '1', '2025-10-28T00:59:41.598Z', '2025-10-28T00:59:42.100Z', '2025-10-28', 'on-time'),
  ('116', '1', '2025-10-28T00:59:42.662Z', '2025-10-28T00:59:43.154Z', '2025-10-28', 'on-time'),
  ('117', '202', '2025-11-20T12:07:57.333Z', '2025-11-20T12:08:05.796Z', '2025-11-20', 'on-time'),
  ('118', '202', '2025-11-20T12:20:42.457Z', '2025-11-20T12:21:33.398Z', '2025-11-20', 'on-time'),
  ('119', '202', '2025-11-21T08:56:02.094Z', '2025-11-21T08:56:10.716Z', '2025-11-21', 'on-time');

-- Table: patients
DROP TABLE IF EXISTS patients;
CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      address TEXT,
      date_of_birth TEXT,
      status TEXT DEFAULT 'active',
      registration_date DATETIME DEFAULT CURRENT_TIMESTAMP
    , updated_at DATETIME, comprehensive_data TEXT, is_deleted INTEGER DEFAULT 0, deleted_at DATETIME);
INSERT INTO patients (id, name, email, mobile, address, date_of_birth, status, registration_date, updated_at, comprehensive_data, is_deleted, deleted_at) VALUES
  ('7', 'Juan Ponce Enrile', 'sample@email.com', '00000000000', 'Manila, Manila, Manila 2600', '1920-01-14', 'active', '2025-10-25 13:08:20', '2025-10-26 06:16:26', '{"lastName":"Enrile","firstName":"Juan","middleName":"Ponce","dateOfBirth":"1920-01-14","age":"99","gender":"male","otherGender":"","address":"Manila","city":"Manila","state":"Manila","zipCode":"2600","contactNumber":"00000000000","email":"sample@email.com","occupation":"","emergencyContactName":"Juan Two","emergencyRelationship":"Relative","emergencyContactNumber":"","hasAllergies":"no","allergiesSpecify":"","takingMedication":"no","medicationSpecify":"","hasSkinConditions":"no","skinConditionsSpecify":"","hadSurgeries":"no","surgeriesSpecify":"","isPregnant":"no","smokes":"no","currentSkincare":"","usedNewProducts":"no","newProductsSpecify":"","hadAdverseReactions":"no","adverseReactionsSpecify":"","initialTreatment":"","initialTreatmentCardDays":"7","staffEmployee":"","treatmentDate":"","totalSales":"","paymentStatus":"full","paymentDiscountType":"amount","paymentDiscount":"","paymentTotalAfterDiscount":"","cashPayment":"","bankTransferEWalletCredit":"","paymentMethod":"cash","paymentReference":"","eWalletCustomName":"","name":"Juan Ponce Enrile","mobile":"00000000000","first_name":"Juan","middle_name":"Ponce","last_name":"Enrile"}', '1', '2025-11-18 13:14:20'),
  ('10', 'Karl Kevin Patient Mangoltad', 'kkjmangoltad132@gmail.com', '09207289568', '071 St, La Trinidad, Benguet 2600', '1994-11-19', 'active', '2025-11-19 12:26:19', NULL, '{"title":"Mr.","lastName":"Mangoltad","firstName":"Karl Kevin","middleName":"Patient","dateOfBirth":"1994-11-19","age":"31","gender":"male","otherGender":"","address":"071 St","city":"La Trinidad","state":"Benguet","zipCode":"2600","email":"kkjmangoltad132@gmail.com","occupation":"","emergencyContactName":"Leticia Alupias","emergencyRelationship":"Aunt","hasAllergies":"no","allergiesSpecify":"","takingMedication":"no","medicationSpecify":"","hasSkinConditions":"no","skinConditionsSpecify":"","hadSurgeries":"no","surgeriesSpecify":"","isPregnant":"no","smokes":"no","currentSkincare":"","usedNewProducts":"no","newProductsSpecify":"","hadAdverseReactions":"no","adverseReactionsSpecify":"","initialTreatment":"Glutathione","initialTreatmentCardDays":"7","staffEmployee":"202","treatmentDate":"2025-11-19","totalSales":"750","paymentStatus":"full","paymentDiscountType":"amount","paymentDiscount":"","paymentTotalAfterDiscount":"750.00","cashPayment":"750.00","bankTransferEWalletCredit":"","paymentMethod":"cash","paymentReference":"","eWalletCustomName":"","phoneNumbers":["09207289568"],"contactNumber":"09207289568","emergencyPhoneNumbers":["09121116614"],"emergencyContactNumber":"09121116614","name":"Karl Kevin Patient Mangoltad","mobile":"09207289568","first_name":"Karl Kevin","middle_name":"Patient","last_name":"Mangoltad"}', '0', NULL);

-- Table: inventory
DROP TABLE IF EXISTS inventory;
CREATE TABLE inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      min_quantity INTEGER DEFAULT 0,
      unit TEXT,
      description TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    , expiry_date DATE, supplier TEXT, platform TEXT, purchase_cost DECIMAL(10,2) DEFAULT 0, date_received DATE);

-- Table: appointments
DROP TABLE IF EXISTS appointments;
CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      treatment TEXT,
      amount DECIMAL(10,2),
      date DATETIME,
      status TEXT DEFAULT 'scheduled',
      FOREIGN KEY (patient_id) REFERENCES patients (id)
    );
INSERT INTO appointments (id, patient_id, treatment, amount, date, status) VALUES
  ('17', NULL, 'Manicure', '400', '2025-10-02', 'scheduled'),
  ('19', NULL, 'General Consultation', '400', '2025-10-02', 'scheduled'),
  ('39', '7', 'Promo Treatment: Sample Promo Treatment', '1599', '2025-10-25', 'scheduled'),
  ('40', '7', 'General Consultation', '499', '2025-10-25', 'scheduled'),
  ('41', '7', 'Promo Treatment: Sample Promo Treatment', '1599', '2025-10-25', 'scheduled'),
  ('42', '7', 'General Consultation', '499', '2025-10-28', 'scheduled'),
  ('43', '7', 'General Consultation', '499', '2025-10-28', 'scheduled'),
  ('44', '7', 'General Consultation', '499', '2025-10-28', 'scheduled'),
  ('49', '7', 'Glutathione', '750', '2025-11-28', 'scheduled'),
  ('50', '10', 'Glutathione', '750', '2025-11-19', 'scheduled'),
  ('51', '10', 'Glutathione', '750', '2025-11-19', 'scheduled'),
  ('52', '10', 'Glutathione', '750', '2025-11-21', 'scheduled'),
  ('53', '10', 'Glutathion', '750', '2025-11-23', 'scheduled'),
  ('54', '10', 'Glutathion', '750', '2025-11-23', 'scheduled'),
  ('55', '10', 'Glutathion', '750', '2025-11-23', 'scheduled');

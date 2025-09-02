CREATE DATABASE IF NOT EXISTS dormitory_management;
USE dormitory_management;

-- 1. Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'tenant', 'technician') NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms Table
CREATE TABLE rooms (
    room_id VARCHAR(10) PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    type VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    status ENUM('available', 'occupied', 'reserved') DEFAULT 'available'
);

-- 3. Tenants Table
CREATE TABLE tenants (
    tenant_id VARCHAR(10) PRIMARY KEY,
    user_id INT,
    room_id VARCHAR(10),
    checkin_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- 4. Technicians Table
CREATE TABLE technicians (
    technician_id VARCHAR(10) PRIMARY KEY,
    user_id INT NOT NULL,
    expertise VARCHAR(100),
    available BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Bills Table
CREATE TABLE bills (
    bill_id VARCHAR(10) PRIMARY KEY,
    tenant_id VARCHAR(10),
    billing_month VARCHAR(7),
    rent DECIMAL(10,2),
    water_unit INT,
    electricity_unit INT,
    water_rate DECIMAL(10,2),
    electricity_rate DECIMAL(10,2),
    total DECIMAL(10,2),
    status ENUM('unpaid', 'paid', 'pending') DEFAULT 'unpaid',
    bill_pdf VARCHAR(255),
    slip_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

-- 6. Repairs Table
CREATE TABLE repairs (
    repair_id VARCHAR(10) PRIMARY KEY,
    tenant_id VARCHAR(10),
    description TEXT,
    assigned_to INT,
    status ENUM('new', 'in_progress', 'completed', 'cancelled') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- 7. Payments Table
CREATE TABLE payments (
    payment_id VARCHAR(10) PRIMARY KEY,
    bill_id VARCHAR(10),
    payment_date DATE,
    amount DECIMAL(10,2),
    slip_url VARCHAR(255),
    verified_by INT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- 8. Contracts Table
CREATE TABLE contracts (
    contract_id VARCHAR(10) PRIMARY KEY,
    tenant_id VARCHAR(10),
    contract_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

-- 9. Settings Table
CREATE TABLE settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    water_rate DECIMAL(10,2) NOT NULL,
    electricity_rate DECIMAL(10,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Notifications Table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    type VARCHAR(50),
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
    channel VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 11. LINE Users Table
CREATE TABLE line_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    line_user_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

// src/pages/admin/AdminRoomManagePage.jsx
import React, { useState } from "react";
import {
  Search, Filter, Plus, Edit2, Trash2, Eye, Home,
  CheckCircle, User, Calendar, DollarSign
} from "lucide-react";

export default function AdminRoomManagePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ข้อมูลตัวอย่าง (แทนที่ด้วย API ของจริง)
  const rooms = [
    {
      id: 1,
      roomCode: "A101",
      roomNumber: "101",
      amenities: "พัดลม • แอร์ • ตู้เย็น",
      price: 3500,
      status: "vacant",
      tenant: null,
      checkinDate: null
    },
    {
      id: 2,
      roomCode: "A102",
      roomNumber: "102",
      amenities: "แอร์ • ตู้เย็น",
      price: 3500,
      status: "occupied",
      tenant: "สมชาย ใจดี",
      checkinDate: "2025-10-27"
    },
    {
      id: 3,
      roomCode: "A103",
      roomNumber: "103",
      amenities: "พัดลม • แอร์ • ตู้เย็น",
      price: 3500,
      status: "occupied",
      tenant: "สมหญิง รักสงบ",
      checkinDate: "2025-09-15"
    },
    {
      id: 4,
      roomCode: "A105",
      roomNumber: "105",
      amenities: "พัดลม",
      price: 3000,
      status: "occupied",
      tenant: "นายทดสอบ ระบบ",
      checkinDate: "2025-08-01"
    },
    {
      id: 5,
      roomCode: "A106",
      roomNumber: "106",
      amenities: "แอร์ • ตู้เย็น",
      price: 3500,
      status: "vacant",
      tenant: null,
      checkinDate: null
    }
  ];

  const getStatusBadge = (status) => {
    if (status === "vacant") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" />
          ว่าง
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
        <User className="w-3.5 h-3.5" />
        มีผู้เช่า
      </span>
    );
  };

  const vacantRooms = rooms.filter(r => r.status === "vacant").length;
  const occupiedRooms = rooms.filter(r => r.status === "occupied").length;
  const totalRevenue = rooms.filter(r => r.status === "occupied")
    .reduce((sum, r) => sum + r.price, 0);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">จัดการห้องพัก</h2>
            </div>
            <p className="text-slate-600 text-sm ml-13">จัดการข้อมูลห้องพักและสถานะการเช่า</p>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 
                       text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 
                       transition-all duration-200 shadow-lg shadow-indigo-200 font-medium"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-5 h-5" />
            สร้างห้อง
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">ห้องทั้งหมด</p>
                <p className="text-3xl font-bold text-indigo-900 mt-1">{rooms.length}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">ห้องว่าง</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{vacantRooms}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-4 border border-sky-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sky-600 font-medium">มีผู้เช่า</p>
                <p className="text-3xl font-bold text-sky-900 mt-1">{occupiedRooms}</p>
              </div>
              <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">รายได้/เดือน</p>
                <p className="text-3xl font-bold text-amber-900 mt-1">
                  {(totalRevenue / 1000).toFixed(0)}K
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาห้อง, ผู้เช่า..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         text-sm bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg 
                           hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4" />
            กรอง
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">ลำดับ</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">ห้อง</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">สิ่งอำนวยความสะดวก</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">ราคา</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">สถานะ</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">ผู้เช่า</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">วันที่เข้าพัก</th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rooms.map((room, index) => (
                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 text-sm">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Home className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{room.roomCode}</p>
                        <p className="text-xs text-slate-500">({room.roomNumber})</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{room.amenities}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{room.price.toLocaleString()}</span>
                    <span className="text-slate-500 text-xs ml-1">บาท</span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(room.status)}
                  </td>
                  <td className="px-6 py-4">
                    {room.tenant ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700 text-sm">{room.tenant}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {room.checkinDate ? (
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700 text-sm">{room.checkinDate}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="ดูรายละเอียด"
                        aria-label="ดูรายละเอียด"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="แก้ไข"
                        aria-label="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบ"
                        aria-label="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">แสดง 1-{rooms.length} จาก {rooms.length} รายการ</p>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium">
              ก่อนหน้า
            </button>
            <button className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium">
              1
            </button>
            <button className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium">
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">สร้างห้องใหม่</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="ปิด"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-slate-600 mb-6">เชื่อมต่อกับ API ของคุณเพื่อเพิ่มฟอร์มสร้างห้อง</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                onClick={() => setShowCreateModal(false)}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                onClick={() => setShowCreateModal(false)}
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
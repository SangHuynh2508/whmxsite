// Real W0182 build from the production game document (2026-09-27) + data.json, for the Build-tab design demos.
window.BUILD = {
 "character": {
  "id": "W0182",
  "name_vi": "Lý Tiểu Hài Hạng Liên",
  "name_cn": "李小孩项链",
  "rare": 4,
  "job": 4,
  "avatar": "../../../../public/assets/characters/avatars/W0182.png"
 },
 "build": {
  "name": "Chuẩn",
  "rating": "",
  "summary": "Tham khảo build của 新月.",
  "weapons": [
   {
    "id": "31344",
    "label": "Tốc độ | Sát thương",
    "rare": 5,
    "icon": "../../../../public/assets/items/itemicon_31344.png",
    "name": {
     "vi": null,
     "cn": "流云鸣沙乐"
    },
    "skills": [
     {
      "name": {
       "vi": null,
       "cn": "沙州曲"
      },
      "text": "进入战斗后的首回合内，速度增加20；<br>触发能量自动获取时，使自身在1回合内防御穿透率增加16%/18%/20%/22%/25%/30%，暴击率增加12%/13%/14%/15%/17%/20%，暴击伤害提高12%/13%/14%/15%/17%/20%；若自身能量自动获取不小于1，则进入战斗后的首次行动即可触发1次前述效果。"
     }
    ]
   },
   {
    "id": "31244",
    "label": "Lục Trí, đơn mục tiêu",
    "rare": 5,
    "icon": "../../../../public/assets/items/itemicon_31244.png",
    "name": {
     "vi": null,
     "cn": "金桂抱月灯"
    },
    "skills": [
     {
      "name": {
       "vi": null,
       "cn": "月桂辉"
      },
      "text": "装备者造成伤害时，使受击敌方单位随机获得降攻、截招或萧瑟状态中的1种；<br>若受击敌方单位存在的属性减益状态不少于3层，则该单位受到的额外伤害提高9%/10%/11%/12%/13%/15%。"
     },
     {
      "name": {
       "vi": null,
       "cn": ""
      },
      "text": ""
     }
    ]
   }
  ],
  "affixes": {
   "noReroll": false,
   "groups": [
    {
     "label": "T0 – ưu tiên nhất",
     "items": [
      {
       "name": {
        "vi": null,
        "cn": "暴击率"
       },
       "percent": true
      }
     ]
    },
    {
     "label": "T2",
     "items": [
      {
       "name": {
        "vi": null,
        "cn": "构素伤害提升"
       },
       "percent": true
      },
      {
       "name": {
        "vi": null,
        "cn": "伤害提升"
       },
       "percent": true
      },
      {
       "name": {
        "vi": null,
        "cn": "暴击伤害"
       },
       "percent": true
      }
     ]
    },
    {
     "label": "T3",
     "items": [
      {
       "name": {
        "vi": null,
        "cn": "生命值"
       },
       "percent": true
      },
      {
       "name": {
        "vi": null,
        "cn": "攻击力"
       },
       "percent": true
      }
     ]
    }
   ]
  },
  "deepens": [
   {
    "label": "Chuẩn",
    "style": {
     "vi": "Trữ Năng",
     "cn": "储能"
    },
    "points": [
     7,
     2,
     0,
     2
    ],
    "columns": [
     {
      "name": {
       "vi": "Trùng Loan",
       "cn": "重峦"
      },
      "points": 7,
      "talents": [
       "Tỉ lệ bạo kích +20%",
       "Sát thương bạo kích +15%",
       "Năng lượng ban đầu +1",
       "Tỉ lệ bạo kích +20%",
       "Tự động hồi năng lượng +0.5",
       "Sát thương bạo kích +15%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-1"
      ]
     },
     {
      "name": {
       "vi": "Nguyên Lưu",
       "cn": "源流"
      },
      "points": 2,
      "talents": [
       "Tấn công +114",
       "Sinh lực +10%",
       "Năng lượng ban đầu +1",
       "Năng lượng ban đầu +1%",
       "Tự động hồi năng lượng +0.5",
       "Tấn công +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-2"
      ]
     },
     {
      "name": {
       "vi": "Giảo Nguyệt",
       "cn": "皎月"
      },
      "points": 0,
      "talents": [
       "Tấn công +114",
       "Tấn công +10%",
       "Năng lượng ban đầu +1",
       "Tấn công +159",
       "Tự động hồi năng lượng +0.5",
       "Tấn công +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-3"
      ]
     },
     {
      "name": {
       "vi": "Linh Phong",
       "cn": "泠风"
      },
      "points": 2,
      "talents": [
       "Sinh lực +335",
       "Sinh lực +10%",
       "Năng lượng ban đầu +1",
       "Sinh lực +468",
       "Tự động hồi năng lượng +0.5",
       "Sinh lực +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-4"
      ]
     }
    ]
   },
   {
    "label": "Lục Trí",
    "style": {
     "vi": "Uy Nhiếp",
     "cn": "威慑"
    },
    "points": [
     7,
     2,
     2,
     0
    ],
    "columns": [
     {
      "name": {
       "vi": "Trùng Loan",
       "cn": "重峦"
      },
      "points": 7,
      "talents": [
       "Tỉ lệ bạo kích +20%",
       "Sát thương bạo kích +15%",
       "Năng lượng ban đầu +1",
       "Tỉ lệ bạo kích +20%",
       "Xuyên giáp +10%",
       "Sát thương bạo kích +15%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-1"
      ]
     },
     {
      "name": {
       "vi": "Nguyên Lưu",
       "cn": "源流"
      },
      "points": 2,
      "talents": [
       "Tấn công +114",
       "Tấn công +10%",
       "Năng lượng ban đầu +1",
       "Tấn công +159",
       "Xuyên giáp +10%",
       "Tấn công +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-2"
      ]
     },
     {
      "name": {
       "vi": "Giảo Nguyệt",
       "cn": "皎月"
      },
      "points": 2,
      "talents": [
       "Phòng ngự vật lý +20%",
       "Sinh lực +10%",
       "Năng lượng ban đầu +1",
       "Phòng ngự cấu tố +20%",
       "Xuyên giáp +10%",
       "Sinh lực +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-3"
      ]
     },
     {
      "name": {
       "vi": "Linh Phong",
       "cn": "泠风"
      },
      "points": 0,
      "talents": [
       "Tỉ lệ né tránh +15%",
       "Sinh lực +10%",
       "Năng lượng ban đầu +1",
       "Tỉ lệ né tránh +15%",
       "Xuyên giáp +10%",
       "Sinh lực +10%",
       "Thử nghiệm hiệu quả kỹ năng, Lưu phái 1-4"
      ]
     }
    ]
   }
  ],
  "rotations": [
   {
    "label": "Mỗi 2 lượt",
    "skills": [
     {
      "id": "W018211",
      "name": "Sinh Tử Luân Chuyển",
      "type": "Kỹ Năng Nghề",
      "icon": "../../../../public/assets/skills/skillicon_W014711.png"
     },
     {
      "id": "W018202",
      "name": "Quang Phân Vụ Nữ",
      "type": "Tuyệt Kỹ",
      "icon": "../../../../public/assets/skills/skillicon_W018202.png"
     },
     {
      "id": "W018211",
      "name": "Sinh Tử Luân Chuyển",
      "type": "Kỹ Năng Nghề",
      "icon": "../../../../public/assets/skills/skillicon_W014711.png"
     },
     {
      "id": "W018201",
      "name": "Đồng Ngôn - Dương",
      "type": "Đánh Thường",
      "icon": "../../../../public/assets/skills/skillicon_Commonattack_W.png"
     }
    ]
   }
  ],
  "tips": [
   "Mỗi 2 lượt lặp lại 1 vòng. Lối Lục Trí – 威慑 cần Vương Thị Thư Hàn Quyển bù 1 năng lượng.",
   "Mỗi lượt đều dùng Kỹ Năng Nghề để cộng tầng Âm Thân.",
   "Khi đủ năng lượng, có thể mang người giảm hồi chiêu như Mạc Cao Quật Ký để tung Tuyệt Kỹ mỗi vòng, tăng tầng Âm Thân.",
   "Mốc dòng thuộc tính (Tam Trí, cấp 120, nghiên cứu tối đa, 流云鸣沙乐): Bạo kích 51,4%; Sát thương Cấu Tố 14,3%; Sát thương 14,3%; Sát thương bạo kích 12,5%; HP 6,8%; Tấn công 5,3%."
  ],
  "teams": [
   {
    "label": "Hệ thống – mạnh",
    "note": "",
    "members": [
     {
      "id": "V0055",
      "name": "Thố Hình Đào Huân",
      "cn": "兔形陶埙",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0055.png"
     },
     {
      "id": "W0029",
      "name": "Lạc Thần Phú Đồ",
      "cn": "洛神赋图",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0029.png"
     },
     {
      "id": "D0166",
      "name": "Thanh Từ Liên Hoa Tôn",
      "cn": "青瓷莲花尊",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/D0166.png"
     }
    ]
   },
   {
    "label": "Hệ thống – không bắt buộc",
    "note": "",
    "members": [
     {
      "id": "S0132",
      "name": "Thập Nhị Hoa Hủy Bôi",
      "cn": "十二花卉杯",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/S0132.png"
     },
     {
      "id": "V0078",
      "name": "Tứ Long Tứ Phượng Tọa",
      "cn": "四龙四凤座",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0078.png"
     }
    ]
   },
   {
    "label": "Súc Thế / Khiếu Kiếm",
    "note": "Mang 1 là đủ.",
    "members": [
     {
      "id": "W0074",
      "name": "Vương Thị Thư Hàn Quyển",
      "cn": "王氏书翰卷",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0074.png"
     },
     {
      "id": "W0164",
      "name": "Bách Hoa Đồ Quyển",
      "cn": "百花图卷",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0164.png"
     }
    ]
   },
   {
    "label": "Hỗ trợ mạnh khác",
    "note": "",
    "members": [
     {
      "id": "W0150",
      "name": "Bộ luật Hammurabi",
      "cn": "汉谟拉比法典",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0150.png"
     },
     {
      "id": "S0174",
      "name": "Thái Dương Thần Điểu",
      "cn": "太阳神鸟",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/S0174.png"
     },
     {
      "id": "W0147",
      "name": "Mạc Cao Quật Ký",
      "cn": "莫高窟记",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0147.png"
     },
     {
      "id": "W0118",
      "name": "Mạc Cao Quật 220",
      "cn": "莫高窟220",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0118.png"
     },
     {
      "id": "W0173",
      "name": "Kim Thạch Lục",
      "cn": "金石录",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0173.png"
     }
    ]
   },
   {
    "label": "Lai Liên kích",
    "note": "Mang 铜犴剑.",
    "members": [
     {
      "id": "V0146",
      "name": "Á Trường Ngưu Tôn",
      "cn": "亚长牛尊",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0146.png"
     },
     {
      "id": "V0169",
      "name": "Hải Thác Đồ",
      "cn": "海错图",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0169.png"
     }
    ]
   },
   {
    "label": "Lai cùng loại sát thương",
    "note": "",
    "members": [
     {
      "id": "V0172",
      "name": "Xích Bích Phú Hiệt",
      "cn": "赤壁赋页",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0172.png"
     }
    ]
   },
   {
    "label": "Lai Thiêu Đốt (cùng buff)",
    "note": "",
    "members": [
     {
      "id": "S0149",
      "name": "Tournesols",
      "cn": "向日葵",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/S0149.png"
     },
     {
      "id": "W0168",
      "name": "Les Nymphéas",
      "cn": "睡莲",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0168.png"
     }
    ]
   },
   {
    "label": "Lai đa đoạn (cùng buff)",
    "note": "",
    "members": [
     {
      "id": "A0160",
      "name": "Thái Phụng Minh Kỳ",
      "cn": "彩凤鸣岐",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/A0160.png"
     },
     {
      "id": "W0099",
      "name": "Ngũ Huyền Tỳ Bà",
      "cn": "五弦琵琶",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0099.png"
     }
    ]
   },
   {
    "label": "Lai triệu hồi (nhiều lượt)",
    "note": "",
    "members": [
     {
      "id": "W0094",
      "name": "T Hình Bạch Họa",
      "cn": "T形帛画",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/W0094.png"
     },
     {
      "id": "A0144",
      "name": "Thiên Cầu Nghi",
      "cn": "天球仪",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/A0144.png"
     }
    ]
   },
   {
    "label": "Lai Việt Vương",
    "note": "Mang 铜犴剑. Việt Vương giác tỉnh kích hoạt Giới Châu, hạ địch thì được hành động lại.",
    "members": [
     {
      "id": "V0091",
      "name": "Việt Vương Câu Tiễn Kiếm",
      "cn": "越王勾践剑",
      "rare": 4,
      "avatar": "../../../../public/assets/characters/avatars/V0091.png"
     }
    ]
   }
  ],
  "teamOther": ""
 }
};

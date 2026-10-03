// Shared content of the three tea-room directions: V0112 酒帐 (Tửu Trướng), r3075.
// CN = real game text. VI = ILLUSTRATIVE ONLY (to judge the layout; the owner translates in Admin).
// vi: null = left untranslated on purpose (the site shows CN + a small dot).
window.TEA = {
  char: {
    id: 'V0112', vi: 'Tửu Trướng', cn: '酒帐',
    avatar: '../../../../public/assets/characters/avatars/V0112.png',
    drawing: 'https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/characters/v0112/drawings/v0112001.webp',
  },
  stages: [
    { img: 'assets/stage_1.png', cn: '缘起', vi: 'Duyên khởi' },
    { img: 'assets/stage_2.png', cn: '相知', vi: 'Tương tri' },
    { img: 'assets/stage_3.png', cn: '契合', vi: 'Khế hợp' },
  ],
  teas: [
    { img: '../../../../public/assets/items/itemicon_81001.png', cn: '大麦茶', vi: 'Trà lúa mạch',
      desc: '我国东北地区有泡饮大麦茶的习惯。与人们通常所称的茶叶不同，大麦是禾本科大麦属植物，大麦茶原料由大麦粒焙炒而成。适合四季泡饮，尤以夏季作为解暑饮料最佳。',
      desc_vi: 'Vùng Đông Bắc có thói quen pha trà lúa mạch. Khác với lá trà thông thường, lúa mạch là cây họ lúa; trà được làm từ hạt lúa mạch rang. Uống được quanh năm, ngon nhất là giải nhiệt mùa hè.',
      comment: '这种茶在最近的餐厅里推广开来不是没道理，清爽解渴，能跟所有菜适配。好茶啊！',
      comment_vi: 'Loại trà này gần đây được các quán ăn chuộng cũng có lý do: thanh mát, giải khát, món nào cũng hợp. Trà ngon!' },
    { img: '../../../../public/assets/items/itemicon_81007.png', cn: '西湖龙井', vi: 'Tây Hồ Long Tỉnh',
      desc: '产于杭州西湖龙井村。状如雀舌，扁长细嫩，泡饮时叶芽直立，醇和柔美。其采摘、炒茶等工艺考究，清明前采摘称“明前”，谷雨前则叫“雨前”，均为高等绿茶。',
      desc_vi: null,
      comment: '雨前龙井、明前龙井都是响当当的好茶，茶叶在丝绸之路上是非常受欢迎的货物。',
      comment_vi: null },
    { img: '../../../../public/assets/items/itemicon_81009.png', cn: '杏皮茶', vi: 'Trà vỏ mơ',
      desc: '杏皮茶是西北特色饮品，以李广杏为原料，用优质杏皮（杏干）熬制而成，酸甜可口，清爽解腻，有解暑生津之功效，是敦煌当地的招牌饮料。',
      desc_vi: 'Đồ uống đặc sản Tây Bắc, nấu từ vỏ mơ khô của giống mơ Lý Quảng. Chua ngọt dễ uống, thanh mát giải ngấy, giải nhiệt và sinh tân dịch. Thức uống nổi tiếng của Đôn Hoàng.',
      comment: '听说你也煮了，我马上就来了。我就说加一点点水果干会很香吧？独家秘方，不用谢。冰的杏皮茶解腻，热的杏皮茶暖手，一年四季都应该常伴你左右。',
      comment_vi: 'Nghe nói ngươi cũng nấu, ta đến ngay đây. Ta đã bảo thêm chút trái cây khô là thơm lắm mà? Bí quyết độc môn, khỏi cảm ơn. Trà vỏ mơ uống lạnh thì giải ngấy, uống nóng thì ấm tay, bốn mùa nên có bên mình.' },
  ],
  topics: [
    { cn: '敦煌夜市', vi: 'Chợ đêm Đôn Hoàng', r: 'like',
      reply: '敦煌夜市物美价廉，拍照也漂亮，你一定要来。最重要的是有我啊！我在那儿也盘了铺面的，提你的名字，免单。',
      reply_vi: 'Chợ đêm Đôn Hoàng đồ tốt giá rẻ, chụp ảnh cũng đẹp, ngươi nhất định phải tới. Quan trọng nhất là có ta! Ta cũng thuê một gian hàng ở đó, cứ xưng tên ngươi, miễn phí.' },
    { cn: '奇怪的酒', vi: 'Rượu kỳ lạ', r: 'like',
      reply: '当然不是什么都能酿成酒，但你不试试怎么知道？',
      reply_vi: 'Đương nhiên không phải thứ gì cũng ủ thành rượu được, nhưng không thử sao biết?' },
    { cn: '耕种季节', vi: 'Mùa cày cấy', r: 'like',
      reply: '顺应时令，生长出的作物才是最佳状态。敦煌不比中原气候温和，也因此这里的作物生长时自有规律，生命力格外顽强，我很喜欢。',
      reply_vi: 'Thuận theo thời tiết, cây trồng mới tốt nhất. Khí hậu Đôn Hoàng không ôn hòa như Trung Nguyên, nên cây cối ở đây lớn lên theo lẽ riêng, sức sống bền bỉ lạ thường. Ta rất thích.' },
    { cn: '修身养性', vi: 'Tu thân dưỡng tính', r: 'like',
      reply: '来，与我听经……笑什么，我瞧你是颇有慧根的，要心怀敬畏才好。',
      reply_vi: 'Lại đây, nghe kinh cùng ta… Cười gì chứ, ta thấy ngươi khá có tuệ căn, phải giữ lòng kính sợ mới được.' },
    { cn: '电子账簿', vi: 'Sổ sách điện tử', r: 'puzzled',
      reply: '办公电子化我当然欢迎，不过你在自己终端里的电子账簿总是做假账吧？不信现在给我看看。',
      reply_vi: null },
    { cn: '低度葡萄酒和果汁有什么区别', vi: 'Rượu vang nhẹ với nước ép khác gì nhau', r: 'puzzled',
      reply: '好伤人的一句话，甜的酒和辣的果汁分明也是不一样的。',
      reply_vi: 'Câu này đau lòng quá. Rượu ngọt với nước ép cay rõ ràng là khác nhau mà.' },
    { cn: '沙漠飙车党', vi: 'Hội đua xe sa mạc', r: 'puzzled',
      reply: '（室内很安静，只有茶水热气缭绕。）', reply_vi: '(Trong phòng rất yên, chỉ có hơi trà lượn lờ.)' },
    { cn: '鸣沙山演唱会', vi: 'Buổi hòa nhạc Minh Sa Sơn', r: 'puzzled',
      reply: '（茶室里一时无人回应。）', reply_vi: '(Trong phòng trà nhất thời không ai đáp lời.)' },
  ],
  branches: [
    { cn: '酒馆的样子', vi: 'Dáng vẻ quán rượu',
      reply: '嗯……你猜我的酒馆是什么样子？', reply_vi: 'Ừm… Ngươi đoán xem quán rượu của ta trông thế nào?',
      next: [
        { cn: '随心而动？', vi: 'Tùy tâm mà đổi?', r: 'like',
          reply: '不错，我早说你有慧根嘛。其实我也并不知道每个客人眼里的酒馆是什么样，那是种很奇妙的感觉——不过总归，我知道该给大家提供什么服务就够了。',
          reply_vi: 'Đúng rồi, ta đã bảo ngươi có tuệ căn mà. Thật ra ta cũng không biết trong mắt mỗi vị khách quán rượu trông ra sao, cảm giác ấy kỳ diệu lắm. Nhưng dù sao, ta biết nên phục vụ mọi người thứ gì là đủ.' },
        { cn: '那它真正的样子呢？', vi: 'Vậy dáng thật của nó thì sao?', r: 'puzzled',
          reply: '凡所有相，皆是虚妄。你看见什么，它就是什么——可别不信，世上很多事，都是如此。',
          reply_vi: 'Phàm cái gì có tướng đều là hư vọng. Ngươi thấy gì, nó chính là thế ấy. Đừng không tin, nhiều chuyện trên đời đều như vậy.' },
      ] },
    { cn: '情报交换服务', vi: 'Dịch vụ trao đổi tình báo',
      reply: '哎哟，这可是隐藏菜单。你从哪里找来的？', reply_vi: 'Ái chà, đây là thực đơn ẩn đấy. Ngươi tìm ra từ đâu vậy?',
      next: [
        { cn: '我想和你交换一个故事。', vi: 'Ta muốn đổi với ngươi một câu chuyện.', r: 'like',
          reply: '让我听听，你有什么故事？最好是开头温馨、中间跌宕、结尾大团圆……我会给你非常有用的公司财务数据分析，指导你接下来的营销方针。怎么样？',
          reply_vi: null },
        { cn: '可以白拿一个情报吗？', vi: 'Lấy không một tin được không?', r: 'puzzled',
          reply: '当然，你是我的特别客户。我还白送你一个游戏，咱们来行酒令，要是你赢了，就送你个真情报。我赢？就送你假一点的情报好了。童叟无欺。',
          reply_vi: 'Được chứ, ngươi là khách đặc biệt của ta. Ta còn tặng kèm một trò: chơi tửu lệnh, ngươi thắng thì ta cho tin thật. Ta thắng ư? Thì cho ngươi tin giả hơn một chút. Già trẻ không lừa.' },
      ] },
  ],
  win: '这盏茶滋味甚美，能不能存茶？让我买上个十年八年的份，累了就来与你品茶共谈一番——你没这个业务吗？我有，下回来我店上可免费试用。',
  win_vi: 'Chén trà này vị thật tuyệt, gửi trà được không? Để ta mua phần cho mười năm tám năm, mệt thì đến cùng ngươi thưởng trà trò chuyện. Ngươi không có dịch vụ này à? Ta có đấy, lần sau đến quán ta được dùng thử miễn phí.',
  lose: '好茶。不知道和酒的技法搭配起来会有什么新产品？player，你喝过酿造茶吗？',
  lose_vi: 'Trà ngon. Không biết kết hợp với kỹ thuật ủ rượu sẽ ra sản phẩm mới gì nhỉ? Ngươi đã uống trà ủ bao giờ chưa?',
  result: { cn: '瓦铫煮春雪\n淡香生古瓷\n你们的情谊又加深了一步……', vi: 'Ấm sành nấu tuyết xuân\nHương thanh tỏa sứ cổ\nTình nghĩa đôi bên lại thêm sâu…' },
};
// Helpers shared by the demos.
window.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Text in VI, else CN + dot (Original Name Rule).
window.txt = (vi, cn) => (vi ? esc(vi) : `<span class="cn" lang="zh">${esc(cn)}</span><span class="dot" aria-hidden="true"></span><span class="sr">(chưa dịch)</span>`);
window.isNarration = (cn) => /^（.*）$/.test(cn);
window.REACT = { like: { img: 'assets/react_like.png', label: 'Khí giả thích chủ đề này' }, puzzled: { img: 'assets/react_puzzled.png', label: 'Khí giả bối rối' } };

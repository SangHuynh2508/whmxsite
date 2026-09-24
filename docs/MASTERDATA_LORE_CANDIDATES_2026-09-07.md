# NeoArtifacts MasterData lore/narrative candidate audit

**Audit date:** 2026-09-07  
**Scope:** all 544 JSON tables in `NeoArtifacts/MasterData/json`  
**Method:** inspected every filename, top-level row count, schema keys (including nested keys), and up to 500 rows of Chinese content. Candidates require narrative evidence such as sustained prose, dialogue, dossier/history text, letters, or story framing; generic `name`/`description` fields alone were not sufficient.

**Result:** 59 candidate tables across the eight requested groups.

## character profiles/biographies

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| characterFiles | 133 | id; recordID; cardIntrolanText; basicFileID; specialFileID | S0181 | 这是一位较为特别的器者。她没有指向性明确的本体。在查阅了不列颠学会提供的资料之后，我们大概能确认，这位女士的出生时间约在公元前1780年之后——火山喷发之时，扬出许多灰烬，她是其中之一。关于此处，我的不少同事提出疑问：“没有实体，如何算是活着？”诚然，那时的她并不符合人类对器者生命的定义。她仅仅是… | Character dossier summary / biography | HIGH |
| characterFileTextMap | 804 | ID; titleLanText; textLanText; headPhoto | S018102 | 庞贝有一套独特的年龄换算法。 她对数字很不精通，说来说去也讲不明白。大概是，她把漫长的千年对应人类的年纪做了区分。青梅加烈酒，她也有过少女时代。 这样也好，我对她说。你生命中面对的宏大太多了，我只以渺小的事物来解构你。那么，庞贝。你也有过青春期吧——骤然终止在那片灰云和死亡之中的青春期。 是有很多… | Unlockable character observation reports and biographical files | HIGH |
| MonsterFileMap | 145 | id; FileTestLanText; PackEntry01-03LanText; PackSPLanText; Peculiarity01-03LanText; MonsterDesLanText | 30004 | 骨刻是一类人形与机械体结合“曲解”，于广州被观测，并与基金会成员发生遭遇战。 该“曲解”形态与曾被记录的“曲解”迥异，为巨型机械体与██的组合，巨型机械体轮廓类似人类上半身骨架，人形体类似████，并在头部发现同样的诡异几何体，降临时伴随建筑沙化粉碎，故命名为“骨刻”。 本次降临伴随大量下型体，且… | Monster/entity dossier and world-lore profile | HIGH |

## character stories

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| BrilliantMap | 56 | id; CharacterID; IconNameLanText; IconInfoLanText; BuffShowLanText | A01004 | “我想给逝去的人，送去一封信。” 愿望杯听见过很多愿望，合理的、不合理的应有尽有。原本在听到这个跨越生死时空的请求时，她遗憾地叹了口气，这，是无法实现的愿望。但…… 眼前的信件无风自动，无火自燃，竟真的在她的眼前，成为了一缕轻烟，散入北风中，消失不见。 阿蒙神收下了愿望，阿蒙神实现了愿望。她很震惊… | Character-focused Huanzhang story vignette | HIGH |

## main story/dialogue

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| narrativeMap | 692 | id; script; nameLanText; narraDesLanText; narraSkipDesLanText | B005001_002 | “号外号外！铜车马要举办一场全新的车展！”伴随着一阵吆喝声，闲来无事的器者接过宣传单，仔细阅读起上面的文字。 “连通古今？前所未有？一场专门为器者举办的车展？门票免费，场内饮料畅饮？看了保证不吃亏？同时现场随机抽选幸运儿赠铜车马马场参观券？还真是有铜车马风格的宣传啊……” | Story-stage narration/summary with script linkage; includes mixed main/side content | MEDIUM |

## event story/dialogue

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| activityMapEventList | 1086 | id; namelanText; descriptionlanText; tipslanText | E002040 | 坊间传闻，数日前风雨大作之夜，有数个异形球状雷电落于郊外。有好奇者近之，只见雷电渐散，有四足之兽缓缓立起，隐约可见狮身牛尾。再眨眼时，周围数百米路灯熄灭，深黑寂夜中唯有该兽之角耀目，雷闪电泳。吸取周围电力后，该兽消失不见，此后每日凌晨，均有方圆百米内电力无端消失之报告。 | Event encounter setup and narrative description | HIGH |
| ActivityPlotMap | 170 | ID; PlotId; PlotInfoLanText | 155 | 第六节 合唱团的纯真演绎令人慰藉，莫高窟220却从带队老师处得知，并非所有人都自愿接受疗愈。在与你、与其他同伴对话后，她决定作为表演者加入音乐节，而你也在她的音乐中得到了放松。这一切是巧合吗，还是向你提出委托的人早有预料呢？ | Event chapter/section plot synopsis | HIGH |
| AdventureNpcTalkMap | 244 | Id; NpcID; EventID; Type; TalkDescLanText; TalkGroup | 1000405 | 石磨上的【推杆】不知道跑到哪里去了，印象中我最后一次见到它好像是在装小麦的袋子旁边，还可以顺道带些【小麦】回来，待会儿磨面粉会用上的。 | Adventure NPC dialogue | HIGH |
| areaExplores | 314 | id; fileId; nameTextlanText; exploreTextlanText; ShowTextLanText | 10334 | 你受邀进入技术部参观他们最新设计的电子模拟烟花。该烟花由投影屏和电子发射器组成，不制造任何空气污染，偌大投影屏在上海分部铺开，电子束在投影屏上绚烂绽放。这时，投影屏的角落却突然出现了一个诡异佝偻的怪物投影…… | Regional exploration vignette | HIGH |
| areaRewardMap | 849 | id; NameLanText; TestShowLanText | Bfe1011903 | 在调查过各种传言后，你认为杂志的转移是有人蓄意为之，于是你准备了大量的杂志作为诱饵，放在陷阱中，等待上钩。坚守了几天后，终于在一个月色明亮的夜晚抓到了这位“主谋”，不出所料，是一位还未获得出行许可的器者，他过于好奇人类世界，对杂志有特殊的爱好。你将此事写成报告，上交给基金会处理。 | Exploration outcome / report vignette | HIGH |
| CaseEventContentMap | 60 | id; NameLanText; TextLanText | 110073 | 午门问我成团是什么意思，我说就是成立一个工作团啊。午门还问我C位是什么，我说就是实打实的岗位。午门说那练习生呢，我说就是要去联系群众啊！ | Case-event dialogue/evidence text | HIGH |
| CaseEventMap | 20 | id; EventNameLanText; EviContentLanText; RightContentLanText; WrongContentLanText; EviNameContentLanText | 11017 | 青铜仙鹤所著书籍：《如何优雅地站着入睡——从入门到精通》—— 其后记上有提到，青铜仙鹤觉得会议室的椅子该换了，一点都不适合睡觉，只能勉强闭目养神。 | Case-event evidence and resolution dialogue | HIGH |
| CookPlotMap | 49 | id; ChatType; TextLanText | 1038 | 这道猪小肠，要先经过九九八十一遍淘洗，确认没有异味后，再焯水，与现做珍珠奶茶一起下锅……_这道菜，我会选用当季新鲜有机草莓和车厘子，仔细洗净，确认无农残后，再根据西红柿炒蛋的做法……我怎么想到的，因为西红柿草莓和车厘子都是红色的啊？_你难道不好奇这些菜式的味道吗？多么有趣的碰撞！ | Cooking-event dialogue | HIGH |
| DispatchStoryMap | 38 | id; NarrativeId; NameLanText; PlotLanText | 1034 | 夏天该怎么过？ 别的组织不清楚，但面对欧陆日渐飙红的气温，上班通勤是极为痛苦的事。塞纳回廊向来会给员工们放一个悠长的、足够前往极地或者正是冬日的南半球的假期，用以避暑。 自从夏天伊始，塞纳回廊的工作人员就再未能联系上维纳斯小姐。器者也会怕热么？ 相熟的画家今年与时装屋合作，将推出全新的服装设计，而… | Dispatch-event story passage | HIGH |
| EventStoryMap | 140 | StoryId; EventType; EventTitleLanText; EventDesLanText; EventOption | A13233 | 随着日落，虫与树在风中的合唱声愈加明显。有他人的陪伴，这些声音不再吓人，你们在这嘶嘶沙沙声中开始聊天。溪山行旅图问你没找到山中之兽是否有点遗憾。 “我旅途中听说过很多奇特的故事，我在想，人们难以抵达的地方，会先以想象力去探索，此后……” 溪山行旅图讲着各地奇特的传闻，你隐隐理解了，将山的感受与细节… | Branching event prose | HIGH |
| HmwyDispatchEventCheckMap | 20 | id; NameLanText; PlotLanText; StoryMulti; EggTitleLanText; EggCopytLanText | HMWYPQ1020 | “我们是来自河北的旅行团，从正定机场飞过来的。原本的旅行计划里没有唐人街，但是旅行团的大家都很想看看异国他乡的Chinatown，就决定把最后一天的自由活动时间用来体验唐人街了。”领队说，“听松石轩的会长说，白石客先生也来自河北，对唐人街还很熟悉，我就临时下了一单。” “白石客先生当然很好地完成了… | Dispatch encounter dialogue/story | HIGH |
| JYCSEventMap | 372 | id; NameLanText; StoryLanText | JYCS0006 | 传闻某人曾受重创，颈间留下旧痕，仅一线相连，却奇迹般存活了多年。你本和当事人约好了时间登门拜访，但你晚到了几天——这位奇人已经身故了。 | Event story vignette | HIGH |
| RogueEvents | 219 | id; NameLanText; DescLanText; OptionNameLanText | 7077 | 面前突兀地出现了一只音箱，你本想直接离开，直到隐隐听见：“公司事务处理了吗？战斗训练做了吗？文件归类了吗？未完成委托的日程安排了吗？”泰极仙翁啊，这是什么超自然力量吗，还是说你正在做噩梦？师傅别念了…… | Roguelike encounter narrative and choices | HIGH |
| RogueEventHandBooks | 44 | id; NameLanText; DescLanText | 34 | 面前突兀地出现了一只音箱，你本想直接离开，直到隐隐听见：“公司事务处理了吗？战斗训练做了吗？文件归类了吗？未完成委托的日程安排了吗？”泰极仙翁啊，这是什么超自然力量吗，还是说你正在做噩梦？师傅别念了…… | Roguelike encounter story archive | HIGH |
| SailingMailMap | 6 | id; MailTitle1LanText; MailTitle2LanText; MailDetailLanText; MailLockLanText | 106 | 在马拉斯盐田，古老的盐池闪耀如大地的眼影， 在马丘比丘，天空之城诉说着印加的辉煌神秘， 在瓦卡奇纳绿洲，沙漠中的宝石孕育着希望的绿意…… 这片神秘的南美土壤，每逢满月迎来巨变： 羊驼长出新肢，高举火把， 从远古岩石下探出头，找寻飞鸟酿造的琼浆。 蔚蓝色的水母，在山中巡游， 化作野树的孢子，沉入蔚蓝… | Event letters and long-form story prose | HIGH |
| SIMtalkListMap | 19 | id; TalkFirstStageLanText; ReplyTalkLanText; TalkTwoStageLanText | 12 | ……外出如遇到纠纷，应当迅速通过终端与基金会联系，并就近寻找当地收藏家协助处理，不能莽撞应对。唔，上次player急急忙忙地离开，就是去帮忙处理器者与人类的纠纷吗？理智和冷静，是处理问题的法宝呢。 | Simulation-event dialogue and replies | HIGH |
| YX2EventMap | 133 | id; EventNameLanText; EventDesLanText; EventOptionLanText | buff1002 | 实习收藏家后辈正在此处等待着你的到来，你猜，她带着什么东西和你交换呢？ 已选类型未获得的奇策出现概率增加。 | Event encounter text with choices and some rule text | MEDIUM |
| ExploreDuckMap | 14 | id; TextLanText | 1003 | 有的器者还是不太能接受新世界的运转方式，所以才需要收藏家你啊！我？人家只是一只鸡啦，什么也做不了噗。 | Exploration mascot dialogue | HIGH |
| battledrama | 409 | id; NameLanText; ContentLanText; ProfilePath | LS100401_00_01 | 哟，是player啊，欢迎来到趣味酒令，让我看看游戏规则……怎么了？没事，我宿醉刚醒，能看清字的……你需要在规定时间内完成作答，本次酒令共有2道题目，答对1道题目及以上视作成功，反之则失败。 | Scripted event/tutorial speaker dialogue mixed with combat instructions | MEDIUM |

## artifact/history descriptions

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| historicalRelicsMap | 133 | id; introductionlanText; dynasty/museum fields; ageStoryA-FLanText | S0181 | 几天后，幸存者返回故土，却发现一切都变了，火山的形态变了，空气中的味道变了，往日熟悉的集市、浴场、庙宇都火灭烟消，但他们仍试图挖掘，运走有价值的物件开始他方的新生活。后来土壤丰沃起来人烟渐盛，当地人称这片地势异于周边的地带为“西维塔（La Civita）”意为“那座城市”忘却了它的本来名姓，直至1… | Artifact description and chronological history | HIGH |
| HistoricalTextMap | 208 | id; TextLanText; TextIntroduceLanText | O7015 | 仇英，字实父，号十洲，江苏太仓人，寓居苏州，明代画家。初为漆工，后改学绘画。在苏州时，他结识文徵明并以周臣为师，这让他融入了文人圈层，并得以增进绘画技艺。中年时名声渐起，与文人、富商、收藏家等往来密切，曾客居于大收藏家周凤来、项元汴等人处，观摩古今先贤绘画，并加以临摹学习，这让其技艺更上一层楼。他… | Historical figure/event article | HIGH |
| MuseumMap | 30 | id; TableNameLanText; MuseumIntroductionLanText; CollectionName1-2LanText; CollectionText1-2LanText | 306002 | 2007年4月，一座承载着成都三千年建城历史的博物馆在金沙遗址原址上拔地而起。这是一座为保护、研究、展示金沙文化和古蜀文明而兴建的考古博物馆，占地面积30万平方米，总建筑面积约40000平方米，分为遗迹馆、陈列馆、文物保护与修复中心、文化交流中心、园林区等部分。馆藏文物种类丰富、体系完整，均具有较… | Museum and collection history | HIGH |
| RelicsMap | 94 | id; FullNameLanText; NameLanText; MuseumNameLanText; RelicTextLanText | SH2001 | 贝币是我国最早的货币形式。最初的贝币都是由特定的天然海贝加工而成。海贝外形美观，造型整齐，小巧玲珑，便于携带，经久耐磨，是优良的一般等价物。为了方便携带，会在贝币的背面钻孔，甚至将整个背面磨平。贝币的单位为“朋”，五贝为一串，两串为一朋。 | Relic/artifact catalogue description | HIGH |
| AnalectsAtlasMap | 7 | id; Desc1-5LanText; VoiceId | 10006 | 孔子迁居蔡国三年后，吴国攻打陈国。楚国前去救援陈国，听说孔子住在陈蔡边境上，便派人去聘请孔子。孔子正要前往拜见，陈、蔡两国的大夫商议：“孔子是位有才德的贤人，他长久停留在陈蔡之间，（说明）大夫们的所做所为都不合他的意。楚国强大，如果他在楚被重用，那么我们陈蔡两国掌权的大夫们就危险了。”于是双方派人… | Historical/philosophical narrative episodes | HIGH |
| AnalectsRecallMap | 7 | id; AnalectsLanText; Interpretation1-2LanText; Keyword1-2LanText; VoiceId | 10002 | 对于楚狂人的嘲讽，孔子非但不生气，还想与他探讨。 | Historical quotation context and interpretation | HIGH |
| QinTimesCollectMap | 24 | id; NameLanText; TextLanText | 1002 | 韩国大臣严遂与相国韩傀不和，他在齐国找到聂政，多次登门拜访并给予厚礼，请求他为自己所用。聂政以需要照顾母亲为由回绝。 后来，聂政的母亲去世，聂政守孝三年，想起严遂知遇之恩，便孤身一人前往刺杀韩傀。 相传聂政刺韩傀时，天空中有白色长虹穿日的景象，古人认为这是发生不寻常之事的征兆。 | Historical anecdote/collectible entry | HIGH |
| QinTimesSkillLvMap | 13 | grouped skill keys; *.NameLanText; *.FilesLanText; *.TextLanText | 1 | 把全国人口五户编为一“伍”。农忙时互相帮助，农闲时参加军事训练。取消了此前“国”与“野”的界限，将散落各地的自耕农的地位提高到了与国都平民相同的地位。 | Historical institution/technology notes embedded in event progression | HIGH |
| TechHandBookMap | 6 | id; NameLanText; DescLanText; EffectdescLanText | 6 | 其法三犁共一牛，一人将之，下种挽耧皆取备焉，日种一顷，至今三辅尤赖其利。 | Technology/history handbook entry | HIGH |
| signInNodeList | 45 | id; signinNotesLanText | 17 | “化妆土”相当于陶瓷胎体的粉底液，又称陶衣。指用较细的陶土或瓷土调和成色彩较为明亮的色浆，施加在色彩暗沉或质地粗糙的胎体表面，达到美化的作用。 | Cultural-history login note | HIGH |
| termsList | 24 | id; NameLanText; PoemLanText; SigninNotesLanText | 12 | 白露时节，寒气渐长，稻谷也到了成熟的季节。“白露白茫茫，谷子满田黄”，“抢秋”便是要尽快收获秋熟作物。欢迎收藏家一同参与“抢秋”，共享丰收之乐。 | Seasonal/cultural note and verse | HIGH |
| TypeJJHMap | 12 | id; NameLanText; FileLanText | 1 | 冬谷基金会下属四大部门之一，负责收藏家与器者相关的资料整理、研究及归档工作。为处理来自各种媒介与渠道的巨量信息，资料部拥有基金会内最多的登记器者和收藏家，他们在工作之余往往也有自己情有独钟的研究领域。通过日复一日细致坚实的积累，资料部始终作为基石支撑着基金会的立足发展。 | Foundation department/world-setting dossier | HIGH |
| OperateSceneMap | 13 | id; NameLanText; DescriptionLanText | 1007 | 松风街坊有一个神奇的地方，您可以在这里画画、唱歌、跳舞……时常有人来此团建交流。 | Location/world-setting description | MEDIUM |

## voice lines/interactions

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| characterLines | 142 | id; drop/regards/appointment/touch/time/strengthen/equip/display/battle line *LanText fields | A0090001 | 其实我见过的眼泪，比见过的笑容多很多。很意外吗？喜极而泣算两边都占所以删除，剩下的也还有不舍的眼泪、心疼的眼泪、失落的眼泪。但那些女孩总还是会勇敢地踏上我，去往一无所知的新的人生。虽然我只是一顶轿子，能为她们遮风挡雨、增添荣光的时间只有片刻。人类总是这么神奇，用片刻的美好就能抵挡很多残酷。那么我能… | Character voice-line bank | HIGH |
| CharacterLinesLanMap | 23 | id; lineType; drop/regards/touch/time/battle/gift/tea/birthday line fields | W0168001_1001 | 生日快乐，阁下。我在没有天空、没有地平线的池塘中诞生，仅一方小小的世界，就足以倒映无限的光影变幻。就像你纯粹真挚的灵魂，始终映照着世间的万千风景。阁下，请闭上眼，在荡漾的水波中，与绿色的垂柳、蓝色的水面、雾紫色的藤萝融为一体，感受光从眼前划过，你许下的愿望必然会实现，光线会照亮你的前路。愿你永远璀… | Additional/variant character voice-line bank | HIGH |
| playerAskMap | 1946 | id; TopicContentLanText; TopicRespLanText | A0156301 | 在海上，我最亲密的朋友就是海螺号了。长长的路虽然偶尔有朋友作伴，但多数时候还是得一个人前行。有时候，我会翻看从前的合照和航行记录。看着看着……当初的记忆和感情就会涌上心头。我的船啊，其实早就变成了一个满载友谊的小舟。每一件礼物都是一个故事，一段记忆。 | Character question-and-response interaction | HIGH |
| CharacterChatMap | 259 | Id; Characterid; Speaker; ChatacterNameLanText; TextLanText; TextNext | GroupE012 | 快快，我们这次一定要去一个足够远的地方，要有清澈的水源、灿烂的阳光，摇尾巴的小狗和一座丰茂如盛夏的葡萄架——你的假期还够吗？ | Character messenger/group-chat dialogue | HIGH |
| characterPreferences | 133 | id; preferenceFeedbackLanText; calmFeedbackLanText; poemLanText | A0086 | 噢噢噢，你找到了这个！你怎么发现的？在哪里找到的？你去了好多地方啊，怎么没叫上我呢？我在家里待得都要疯掉啦，没有人跟我说话，我现在学会了一样本领，虽然听起来很不起眼，但是我现在可以和锅铲对话了，首先你得想象自己变成了锅铲！这样才能对它的处境感同身受，如果你没有及时清洗它，它肯定是要骂骂咧咧的……啊… | Gift/preference reactions and character verse | HIGH |
| highteaCharacterMap | 133 | id; VictoryEndLanText; VictoryEnd2LanText | A0086 | 聊天可真有意思，我看见有人说聊天最重要的就是说废话的技巧。说废话只要说的得当就能让人心情愉快。那么我觉得不说废话一定更有意思吧，不过我每天尽力地与大家进行有意义的交谈，大家却没有觉得心情很愉快的样子，我看你好像心情愉快，那么是怎样说话起了作用呢让我调查一下……你，你别走呀！ | High-tea interaction dialogue | HIGH |
| NovelInteractionMap | 13 | Id; MsgLanText | 3 | 谢谢你帮我抓住了小猫！啊，摸摸它的尾巴可以让它安静一点……\|哇，这个小家伙好像不排斥player……再摸摸它吧！\|呼噜呼噜，它把头低下来了呢！ | Interactive scene dialogue sequence | HIGH |
| PackUpCollectMap | 11 | id; AnswerLanText | A1005 | 我记得它！它是我们在荒原见的第一株野草，青瓷莲花尊说它如果生活在净土外，必定会生出灵智，化身为人，剩下的……且听下回分解！ | Character response to collected memories/items | HIGH |

## item/equipment lore

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| equipmentFiles | 110 | id; weight; batch; equipDefinelanText; classifylanText; materiallanText; makerlanText; textlanText | 31142 | 设计师在去过一趟川渝地区后，整日失魂落魄，嘴里总念叨着什么。仔细一听，似乎是：“熊猫……什么时候可以发大熊猫，大熊猫好可爱……啊，毛茸茸的大熊猫……” 或许这就是该系列装备诞生的原因。特质光学打印金属上色，仿竹剑设计，削铁如泥，难道是参观大熊猫基地时逗熊猫的不二法宝？工作人员会把你拦下来，请不要实… | Equipment dossier/flavor lore | HIGH |
| itemMap | 2553 | id; nameLanText; DescriptionLanText; ConcisedescriptionLanText | 10001 | 用于实现器者致知提升。 这是从基金会及博物馆拿到的资料徽章，相关的徽章还会有多少呢？ 当致知等级大于等于陆时，再次获得该道具将转化为进阶分析报告*10 | Item descriptions; mixed functional and lore-bearing entries | MEDIUM |
| AdventureItemMap | 111 | id; NameLanText; DescLanText | 1802 | 烤好的面包，可以直接吃，也可以继续制作别的美食 | Adventure item flavor description | MEDIUM |
| FormulaMap | 249 | id; GroupNameLanText; DescriptionLanText; TipsLanText | 20102135 | 收藏家在金银纪行主题研学途中的经验感悟颇多，因此整理成册，其学术价值尚不明确。可在研学易市进行兑换。 可在研学易市进行兑换。 | Crafting/formula flavor description | MEDIUM |
| weaponMade | 3 | nested weapon ID; *.MasterNameLanText; *.MasterCompanyLanText; *.MasterDes1LanText; *.MasterDes2LanText; *.MasterTagLanText | 1001019 | 冬谷基金会技术部下属机密科室，与各国各界顶尖工作室合作，专注生产最优良的武器。由于具有极高的杀伤力，兼操纵难度极高，每把武器均由技术部登记在册，并配备全方位使用注意手册。 | Weapon manufacturer and product lore | HIGH |
| Medals | 41 | id; NameLanText; DesLanText; RemarksLanText | M10004 | 燃烧吧！毁灭吧！烧掉不安、遗憾和阻碍。你不会在此止步，我不会就这样死去。收藏家，在火光的尽头，我会亲手把这封信交给你。信中有什么？或许是一颗向日葵的种子吧。 | Medal/collectible flavor text | HIGH |
| FriendSkinMap | 11 | id; NameLanText; DescribeLanText; UnLockTipslanText | PF02 | 音律跳动，乐声悠悠，一起来享受美妙的音乐节吧！听，在缤纷舞台之上奏响的旋律，这是属于过去的声音，也是属于现在的声音。 | Chat/background cosmetic flavor lore | MEDIUM |
| FriendChatSkinMap | 2 | id; NamelanText; DescribelanText; UnLockTipslanText | CHAT02 | 技术部为你打造了新的终端入口，吉祥的颜色，复古的造型，让你想起小时候咬着糖葫芦，走过街角，看见那只塞满信件的绿邮筒。 | Chat cosmetic flavor lore | MEDIUM |
| GlassMergeMap | 8 | id; NameLanText; DescLanText | 105 | 参考器者丙午神钩的数据制作。豪华的外观之上还搭载了各种功能，图像放大、成分分析，还有变色灯带……这个一定能用上！ | Crafted-object flavor description | MEDIUM |

## chapter/mission narrative

| TABLE_NAME | ROW_COUNT | IMPORTANT_FIELDS | SAMPLE_ID | SHORT_CN_SAMPLE | LIKELY_CONTENT_TYPE | CONFIDENCE |
|---|---:|---|---|---|---|---|
| AdventureChapterMap | 10 | id; NameLanText; NarrationTextLan; NpcDescLanText; PreviousChapter; NextChapter; FinalChapter | 107 | 斯克里博尼亚·阿提卡是一位助产士，她的丈夫是一位外科医生，她的墓碑上记录了她的工作场景，她正指导并帮助一位产妇分娩，在另一块墓碑上记录着她的丈夫用棉花为病人清理伤口的场景。在庞贝的墓区，阿提卡夫妇以墓碑昭示职业成就的情况并非孤例，我们可以看到一位名叫蕾丝提图塔（Restituta）的女性医生为她的… | Chapter framing and historical narration | HIGH |
| AdventureEventMap | 93 | id; ChapterID; EventNameLanText; EventContentLanText; GoalDescLanText | 10200 | 前往热食店，找到店老板普拉奇杜斯 | Mission/event objective with narrative framing | MEDIUM |
| InternEventKV | 118 | id; EventNameLanText; EventDesLanText; LevelShowLanText | A21001 | 有时候你会疑惑，自己是出门百分百招惹曲解的体质吗？算了，放弃思考，准备开战！ 推荐等级：60 | Mission-node flavor/setup text mixed with level guidance | MEDIUM |
| TrainingSeriesMap | 6 | id; NameLanText; DescLanText | 20003 | 本次“作业集”的地点设置在了华北地区，场地的布置与目标的设定由秋操杯和桃源仙境图两位器者操刀。一边听小曲儿一边与模拟曲解对战，这就是华北地区的悠闲淡定吗？ | Training chapter/series framing | MEDIUM |
| activityMapGroupList | 177 | id; NameLanText; DescriptionLanText | 20763 | 在梵高踏足博里纳日之前，那片灰黑色的土地就已经出现在了他的绘画中，他在画册中先行认识了这座城市与矿工，等他真正进入这个区域，色彩便和津德尔特截然不同了，荒凉的旷野上只有生硬的房子，异常巨大而突兀的黑色矿山横亘在平原上，空气中悬浮着粗粝的灰尘，矿上的人们不分男女老少，都是黑沉沉一片，他们爬进矿井，钻… | Activity-region/chapter setting description | HIGH |

## Not promoted to lore candidates

The following conspicuous names were checked but contain routing, IDs, titles, rewards, or gameplay text rather than substantive player-facing narrative in this dump:

- `MainPlotMap`, `BranchPlotMap`, `branchChapterList`, `branchStoryList`, `branchEventList`, `StoryQuestMap`, `EventTypeStoryMap`, `SIMplotMap`, and `YX2NarrativeMap`: story/chapter routing or title metadata with no narrative Chinese sample.
- `missionMap`, `questEvent`, `SailingQuestMap`, and `dungeonMap`: objectives, conditions, or stage metadata; generic mission text does not by itself establish lore.
- `CampPlotMap`, `ContractPlots`, and `Contract3Plots`: despite plot-like names, sampled content is combat modifiers or stage rules.
- `skillMap`, `characterSkillMap`, `characterPassiveSkillMap`, `buffMap`, and equipment-skill tables: gameplay mechanics, not lore.
- `langGlobal`: a broad localization aggregate; narrative-looking strings are better attributed to their domain tables above.

## Confidence guide

- **HIGH:** schema and sampled Chinese directly demonstrate sustained lore, dialogue, biography, history, or story prose.
- **MEDIUM:** the table mixes narrative/flavor text with functional, progression, tutorial, or gameplay content and should be filtered by field or row during extraction.

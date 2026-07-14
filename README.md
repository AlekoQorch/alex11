# ავტოდაილერი + SMS

**iPhone-იდან პირდაპირ** — ორი გზა: **PWA** (Safari) ან **iOS აპი** (CallKit).

---

## 📱 iOS აპი (CallKit) — რეკომენდებული

Safari/PWA **ვერ ხედავს** Calling vs მიპასუხეს — Apple-ის შეზღუდვაა.  
**Native iOS აპი** CallKit-ით ავტომატურად ამოიცნობს:

| სტატუსი | რას ნიშნავს |
|--------|-------------|
| **Calling** | ირეკება, ჯერ არ პასუხობენ |
| **მიპასუხეს** | ზარი დაკავშირდა |
| **დასრულდა** | ავტომატური მოდალი + SMS / შემდეგი |

### დაინსტალირება (Mac + Xcode)

1. **Clone** რეპო:
   ```
   git clone https://github.com/AlekoQorch/alex11.git
   cd alex11
   ```
2. გახსენი **Xcode**-ში: `AutoDialerSMS.xcodeproj`
3. iPhone USB-ით → **Signing & Capabilities** → აირჩიე შენი Apple ID Team
4. **Run** (▶) — აპი დაინსტალირდება iPhone-ზე
5. პირველ გაშვებაზე: **Allow** შეტყობინებები + მიკროფონი

### რას აკეთებს iOS აპი

- 📞 ავტოდაილერი — ნომრების რიგი, CallKit სტატუსი
- 💬 SMS — 4 ალდაგის შაბლონი (PWA-ს იდენტური)
- 📋 ისტორია — ბოლო 50 ზარი
- ✓ ნომრების მონიშვნა დარეკვის შემდეგ

---

## 🌐 PWA (Safari — Mac არ გჭირდება)

### ❌ HTML კოდი ხედავ? — არასწორია!

თუ `<!DOCTYPE html>` ჩანს — აპი არ გაიხსნა. გჭირდება **ერთხელ** GitHub Pages ჩართვა.

### ✅ შენ ერთი რამ გააკეთე (Save):

1. გახსენი: **https://github.com/AlekoQorch/alex11/settings/pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → Folder: **/docs**
4. **Save** → 2-3 წუთი დაელოდე
5. გახსენი: **https://alekoqorch.github.io/alex11/**

### Home Screen-ზე:
Share ⬆️ → **Add to Home Screen** → Add

დეტალური ინსტრუქცია: [INSTALL-KA.md](INSTALL-KA.md)

### ⚠️ PWA შეზღუდვა iOS-ზე

Safari **ვერ** ხედავს Calling/მიპასუხეს. ზარის შემდეგ **ხელით** აირჩევ: „არ მიპასუხეს“ / „მიპასუხეს“.  
ზუსტი ავტომატური დეტექციისთვის გამოიყენე **iOS აპი** ზემოთ.

---

## ❓ რატომ არ არის App Store-ში?

Apple-ის წესი: App Store/TestFlight = **$99/წელი** + Mac/Xcode.  
**ჩვენი გადაწყვეტა:** PWA (უფასო) + Native iOS აპი Xcode-ით (უფასო, Mac საჭიროა).

---

## რას აკეთებს (ორივე ვერსია)

| ფუნქცია | PWA | iOS აპი |
|--------|-----|---------|
| 📞 ავტოდაილერი | ✓ | ✓ |
| Calling/მიპასუხეს | ✗ (ხელით) | ✓ CallKit |
| 💬 SMS შაბლონები | ✓ 4 | ✓ 4 |
| 📋 ისტორია | ✓ | ✓ |

---

## გამოყენება

1. ჩაწერე/ჩასვი ნომრები
2. **„დაწყება“** → ტელეფონი გაიხსნება
3. iOS აპი: სტატუსი ავტომატურად; PWA: აირჩიე შედეგი
4. SMS ან შემდეგი ნომერი

---

## თუ ძველი ვერსია ჩანს (iPhone cache)

1. Home Screen-იდან წაშალე ძველი ხატულა
2. Safari-ში გახსენი: `https://alekoqorch.github.io/alex11/?v=39`
3. თავიდან **Add to Home Screen**

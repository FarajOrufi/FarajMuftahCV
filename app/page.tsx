"use client";

import { useEffect, useState } from "react";
import SignalField from "./signal-field";
import ZoomScene from "./zoom-scene";
import SoundControl from "./sound-control";

type Language = "en" | "ar";

const milestoneSignals: Record<string, readonly string[]> = {
  "2007": ["Visual Basic 6", ".NET", "Windows XP", "Troubleshooting"],
  "2011": ["Windows Support", "Microsoft Access", "Archiving", "User Support"],
  "2013": ["VoIP", "Networks", "Cisco", "ESXi"],
  "2024": ["TypeScript", "React", "Next.js", "Supabase"],
};

const copy = {
  en: {
    nav: ["Story", "Experience", "Projects", "Contact"],
    name: "FARAJ ALORFI",
    line: "Signals. Systems. Intelligence.",
    roles: "Remote IT Support · Communications · AI-Assisted Development",
    chapter: "02 / THE HUMAN SIGNAL",
    headline: "TECHNOLOGY WAS ALWAYS ABOUT PEOPLE.",
    statement: "I’m drawn to the moment when complexity becomes clear — when a problem becomes a system, and a system becomes something people can trust.",
    journey: "2007 — WHERE CURIOSITY BEGAN",
    language: "Enter Arabic",
    scroll: "Continue into the light",
    pathChapter: "03 / THE LONG VIEW",
    pathTitle: "A path built on responsibility, then expanded by curiosity.",
    pathIntro: "From supporting people and communication systems to building digital products, the thread has stayed the same: understand what matters, make it dependable, and keep learning.",
    milestones: [
      { year: "2007", title: "Curiosity began behind the screen", text: "Programming and repair raised the first questions: how does a system work, why does it fail, and how can it serve people better?" },
      { year: "2011", title: "Support began with people", text: "Help desk work, user support, archives, and practical systems for everyday needs." },
      { year: "2013", title: "Communication became infrastructure", text: "Internal communications, VoIP, networks, and the quiet responsibility of keeping systems available." },
      { year: "2024", title: "Curiosity became a second craft", text: "Independent web and mobile products built through AI-assisted design and development workflows." },
    ],
    portraitChapter: "04 / BETWEEN DISCIPLINES",
    portraitTitle: "I don’t see separate fields. I see connections waiting to be built.",
    portraitText: "Support taught me to listen. Communications taught me reliability. Building products taught me to turn ideas into experiences. Together, they shape how I approach every problem.",
    projectsChapter: "05 / SELECTED WORK",
    projectsTitle: "Ideas made tangible.",
    projectsIntro: "Independent products shaped through research, design, iteration, and private source-code workflows.",
    visit: "Visit live project",
    projects: [
      { name: "AL-WAD", label: "Independent web product", href: "https://al-wad.vercel.app/" },
      { name: "MUTABI", label: "Independent web product", href: "https://mutabi.vercel.app/" },
    ],
    contactChapter: "06 / OPEN HORIZON",
    contactTitle: "Let’s build something people can trust.",
    contactText: "For thoughtful collaborations, digital products, communications, or technical support conversations.",
    email: "Start a conversation",
    resume: "Download résumé",
    closing: "Curiosity shaped the path. Responsibility gave it direction.",
  },
  ar: {
    nav: ["القصة", "الخبرة", "المشاريع", "تواصل"],
    name: "فرج العرفي",
    line: "فضول. أنظمة. تجارب.",
    roles: "دعم تقني · اتصالات وشبكات · تطوير رقمي بمساعدة الذكاء الاصطناعي",
    chapter: "02 / الإشارة الإنسانية",
    headline: "لم تبدأ التقنية عندي من الشاشة، بل من محاولة فهم ما يحدث خلفها.",
    statement: "في كل نظام هناك قصة لا تظهر من النظرة الأولى. بدأت من فضول صغير تجاه البرمجة وأعطال الأجهزة، ثم تحوّل الفضول إلى خبرة عملية في الدعم، والشبكات، والاتصالات، وبناء الحلول الرقمية. ومع الوقت، صار كل عطل نافذة لفهم أعمق، وكل فكرة فرصة لبناء تجربة أوضح.",
    journey: "2007 — من هنا بدأ الفضول العملي",
    language: "Enter English",
    scroll: "ابدأ الرحلة",
    pathChapter: "03 / النظرة البعيدة",
    pathTitle: "مسار لا يتحرك في خط مستقيم، بل يتوسع مع كل تجربة.",
    pathIntro: "من البرمجة الأولى إلى صيانة الأنظمة، ومن دعم المستخدمين إلى الاتصالات والبنية التحتية، ثم إلى بناء المنتجات الرقمية؛ تشكّلت الرحلة كطبقات متراكمة من الفهم العملي، حيث تضيف كل مرحلة زاوية جديدة للنظر إلى التقنية.",
    milestones: [
      { year: "2007", title: "بدأت الرحلة بفهم ما يحدث خلف الشاشة.", text: "كانت البرمجة والصيانة أول بابين للفضول: كيف يعمل النظام؟ لماذا يتعطل؟ وكيف يمكن إصلاحه بطريقة تجعل التجربة أوضح وأسهل؟" },
      { year: "2011", title: "اقتربت التقنية أكثر من الناس.", text: "هنا أصبح السؤال مختلفًا: ليس كيف يعمل النظام فقط، بل كيف يستخدمه الناس، وكيف يمكن تحويل التعقيد اليومي إلى خطوات أبسط وأكثر تنظيمًا." },
      { year: "2013", title: "أصبحت الموثوقية جزءًا من العمل اليومي.", text: "في عالم الاتصالات والشبكات، لا يكفي أن يعمل الحل مرة واحدة؛ يجب أن يستمر، أن يُراقَب، وأن يبقى حاضرًا بهدوء عندما يحتاجه الناس." },
      { year: "2024", title: "اتسعت الخبرة نحو بناء التجارب الرقمية.", text: "ما بدأ كفضول تجاه الأعطال والأنظمة، صار قدرة على تحويل الأفكار إلى مواقع وتطبيقات وتجارب رقمية قابلة للاستخدام والتطوير." },
    ],
    portraitChapter: "04 / بين التخصصات",
    portraitTitle: "أعمل في المساحة التي تلتقي فيها التفاصيل الصغيرة بالصورة الكبيرة.",
    portraitText: "علّمتني الصيانة أن أبحث عن السبب لا العرض فقط. وعلّمني الدعم أن أسمع المشكلة بلغة المستخدم. وعلّمتني الاتصالات أن الاعتمادية لا تظهر عندما يعمل كل شيء، بل عندما لا يشعر أحد بوجود العطل. أما بناء المنتجات، فجمع كل ذلك في تجربة يمكن لمسها وتطويرها.",
    projectsChapter: "05 / أعمال مختارة",
    projectsTitle: "أفكار تحولت إلى تجارب قابلة للاستخدام.",
    projectsIntro: "مشاريع رقمية مستقلة، بُنيت من البحث والتجربة والتطوير، حيث تساعد أدوات الذكاء الاصطناعي على تسريع الطريق، بينما تبقى الخبرة العملية هي ما يحدد جودة الحل.",
    visit: "زيارة المشروع",
    projects: [
      { name: "AL-WAD", label: "منتج ويب مستقل", href: "https://al-wad.vercel.app/" },
      { name: "MUTABI", label: "منتج ويب مستقل", href: "https://mutabi.vercel.app/" },
    ],
    contactChapter: "06 / أفق مفتوح",
    contactTitle: "لنبنِ حلًا واضحًا يعمل بثقة.",
    contactText: "إذا كانت لديك فكرة تحتاج إلى شكل، أو مشكلة تحتاج إلى ترتيب، أو تجربة رقمية تحتاج أن تصبح أوضح؛ فالبداية دائمًا من فهم جيد لما يحدث.",
    email: "ابدأ محادثة",
    resume: "تحميل السيرة الذاتية",
    closing: "ما بدأ كفضول تجاه الأعطال، أصبح طريقة في بناء حلول يفهمها الناس ويثقون بها.",
  },
} as const;

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const content = copy[language];
  const isArabic = language === "ar";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic, language]);

  return (
    <main className="site-shell">
      <SignalField />
        <header className="site-header">
          <SoundControl arabic={isArabic} />
          <nav aria-label={isArabic ? "التنقل الرئيسي" : "Primary navigation"}>
            {content.nav.map((item, index) => (
              <a key={item} href={["#story", "#experience", "#projects", "#contact"][index]}>{item}</a>
            ))}
          </nav>
          <button className="language-portal" type="button" onClick={() => setLanguage(isArabic ? "en" : "ar")} aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}>
            <span className="portal-orbit" aria-hidden="true" />
            <span>{content.language}</span>
          </button>
        </header>
      <ZoomScene id="top" label={content.name} first>
        <div className="hero-content" dir={isArabic ? "rtl" : "ltr"}>
          <h1 id="hero-title">{content.name}</h1>
          <p className="hero-line">{content.line}</p>
          <span className="gold-rule" aria-hidden="true" />
          <p className="hero-roles">{content.roles}</p>
        </div>

        <a className="scroll-cue" href="#story"><span>{content.scroll}</span><i aria-hidden="true" /></a>
      </ZoomScene>

      <ZoomScene id="story" label={content.chapter}>
        <div className="human-copy" dir={isArabic ? "rtl" : "ltr"}>
          <p className="section-number">{content.chapter}</p>
          <span className="short-rule" aria-hidden="true" />
          <h2 id="human-title">{content.headline}</h2>
          <p>{content.statement}</p>
        </div>
        <p className="journey-marker">{content.journey}</p>
      </ZoomScene>

      <ZoomScene id="experience" label={content.pathChapter}>
        <div className="path-heading">
          <p className="section-number">{content.pathChapter}</p>
          <h2 id="path-title">{content.pathTitle}</h2>
          <p>{content.pathIntro}</p>
        </div>
      </ZoomScene>
          {content.milestones.map((item, index) => (
            <ZoomScene id={`year-${item.year}`} label={item.title} key={item.year} signals={milestoneSignals[item.year]}>
            <article className="milestone" style={{ "--step": index } as React.CSSProperties}>
              <span>{item.year}</span>
              <div><h3>{item.title}</h3><p>{item.text}</p></div>
            </article>
            </ZoomScene>
          ))}

      <ZoomScene id="connections" label={content.portraitChapter}>
        <div className="portrait-copy">
          <p className="section-number">{content.portraitChapter}</p>
          <h2 id="portrait-title">{content.portraitTitle}</h2>
          <p>{content.portraitText}</p>
        </div>
      </ZoomScene>

      <ZoomScene id="projects" label={content.projectsChapter}>
        <div className="projects-heading">
          <p className="section-number">{content.projectsChapter}</p>
          <h2 id="projects-title">{content.projectsTitle}</h2>
          <p>{content.projectsIntro}</p>
        </div>
        <div className="project-ledges">
          {content.projects.map((project, index) => (
            <a key={project.name} href={project.href} target="_blank" rel="noreferrer" className="project-ledge">
              <span className="project-index">0{index + 1}</span>
              <div><p>{project.label}</p><h3>{project.name}</h3></div>
              <span className="project-visit">{content.visit}</span>
            </a>
          ))}
        </div>
      </ZoomScene>

      <ZoomScene id="contact" label={content.contactChapter} last>
      <footer className="contact-section" dir={isArabic ? "rtl" : "ltr"}>
        <p className="section-number">{content.contactChapter}</p>
        <h2>{content.contactTitle}</h2>
        <p className="contact-text">{content.contactText}</p>
        <div className="contact-actions">
          <a href="mailto:Farajalorfi09@gmail.com">{content.email}</a>
          <a href="/Faraj-Alorfi-Resume.pdf" download>{content.resume}</a>
        </div>
        <p className="closing-line">{content.closing}</p>
        <div className="footer-base"><span>© {new Date().getFullYear()} Faraj Alorfi</span><span>Benghazi · Libya</span></div>
      </footer>
      </ZoomScene>
    </main>
  );
}

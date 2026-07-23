export type QuizId = "millionaire" | "kculture";
export type QuizQuestion = {
  id: string;
  category: "Mind" | "BTS" | "Korean Cinema" | "K-Drama";
  question: string;
  options: readonly [string, string, string, string];
  correct: number;
  hint: string;
};

const q = (id: string, category: QuizQuestion["category"], question: string, options: QuizQuestion["options"], correct: number, hint: string): QuizQuestion => ({ id, category, question, options, correct, hint });

export const millionaireQuestions: readonly QuizQuestion[] = [
  q("m01","Mind","A farmer has 17 sheep. All but 9 run away. How many remain?",["8","9","17","26"],1,"“All but 9” means that 9 did not run away."),
  q("m02","Mind","All Neris are poets. No poets are robots. Which statement must be true?",["Some robots are Neris","Every robot is a poet","No Neri is a robot","Some poets are robots"],2,"Follow both rules without adding any new assumption."),
  q("m03","Mind","What number comes next: 2, 6, 12, 20, 30, ?",["36","40","42","44"],2,"Each term can be formed by multiplying two consecutive numbers."),
  q("m04","Mind","A bat and a ball cost $1.10 together. The bat costs $1 more than the ball. How much does the ball cost?",["$0.05","$0.10","$0.15","$0.20"],0,"If the ball were ten cents, the total would be too high."),
  q("m05","Mind","Yesterday was two days before Thursday. What day is today?",["Tuesday","Wednesday","Thursday","Friday"],1,"First identify the day two days before Thursday."),
  q("m06","Mind","Two fair coins are tossed. What is the probability of getting exactly one head?",["1/4","1/3","1/2","3/4"],2,"List HH, HT, TH and TT."),
  q("m07","Mind","Five machines make five items in five minutes. How long would 100 machines take to make 100 items?",["5 minutes","20 minutes","100 minutes","500 minutes"],0,"Each machine makes one item in five minutes."),
  q("m08","Mind","Six people each shake hands with every other person exactly once. How many handshakes occur?",["12","15","18","30"],1,"Each handshake belongs to a unique pair of people."),
  q("m09","Mind","Three boxes are labelled Apples, Oranges and Mixed. Every label is wrong. You may take one fruit from one box. Which box should you choose from first?",["Apples","Oranges","Mixed","Any box"],2,"Because every label is wrong, the box labelled Mixed cannot actually be mixed."),
  q("m10","Mind","Three switches are outside a closed room. One controls a bulb inside. You may enter the room only once. Which method identifies the correct switch?",["Turn on one switch and enter immediately","Turn on all three switches and enter","Turn on switch one, wait, turn it off, turn on switch two, then enter","Flip each switch once and choose randomly"],2,"The bulb can reveal both light and heat."),
  q("m11","Mind","How many times does the digit 9 appear when writing every number from 1 to 100?",["10","18","19","20"],3,"Count the ones position and tens position separately."),
  q("m12","Mind","What is the smaller angle between the clock hands at 3:15?",["0 degrees","7.5 degrees","15 degrees","22.5 degrees"],1,"At 3:15, the hour hand has already moved beyond the number 3."),
  q("m13","Mind","Two ropes each take exactly 60 minutes to burn, but they burn unevenly. How can you measure exactly 45 minutes?",["Burn half of one rope, then the other half","Light both ends of one rope and one end of the other; when the first finishes, light the second end of the remaining rope","Light one rope, wait 30 minutes, then light the second","Fold one rope into four equal parts"],1,"Lighting both ends makes a 60-minute rope finish in 30 minutes."),
  q("m14","Mind","A cube is painted on every face and cut into 27 equal smaller cubes. How many small cubes have exactly two painted faces?",["8","12","18","20"],1,"Look at the centre cube on each of the large cube’s 12 edges."),
  q("m15","Mind","Eight identical-looking balls contain one ball that is heavier. What is the minimum number of balance-scale weighings needed to guarantee finding it?",["1","2","3","4"],1,"Divide the balls into groups of three, three and two."),
];

export const kcultureQuestions: readonly QuizQuestion[] = [
  q("k01","BTS","In which year did BTS officially debut?",["2011","2012","2013","2014"],2,"Their debut arrived in the same year as “No More Dream.”"),
  q("k02","BTS","Which BTS member is the group’s leader?",["Jin","RM","Jimin","V"],1,"His stage name was previously Rap Monster."),
  q("k03","BTS","Who is the youngest member of BTS?",["Jungkook","Jimin","V","SUGA"],0,"He is commonly called the group’s golden maknae."),
  q("k04","BTS","What is the official name of the BTS fandom?",["BLINK","MOA","ARMY","ONCE"],2,"The name is commonly written in capital letters."),
  q("k05","BTS","Which song was BTS’s first single performed entirely in English?",["Butter","Dynamite","Permission to Dance","Life Goes On"],1,"Its title describes something explosive."),
  q("k06","BTS","Halsey featured on which BTS song?",["Boy With Luv","Fake Love","Black Swan","Run"],0,"The title contains the word “Boy.”"),
  q("k07","BTS","Which member is widely associated with the nickname “Worldwide Handsome”?",["Jin","RM","j-hope","Jungkook"],0,"He is the oldest BTS member."),
  q("k08","BTS","Which member released the solo album “Jack in the Box”?",["V","Jimin","j-hope","Jin"],2,"His stage name includes a positive emotion."),
  q("k09","BTS","Which order correctly represents the Love Yourself album series?",["Answer → Her → Tear","Tear → Answer → Her","Her → Tear → Answer","Her → Answer → Tear"],2,"The journey begins with Her and concludes with Answer."),
  q("k10","BTS","Which BTS song became their first number-one single on the Billboard Hot 100?",["DNA","Dynamite","Spring Day","Idol"],1,"It was also their first fully English-language single."),
  q("k11","Korean Cinema","Who directed “Parasite”?",["Park Chan-wook","Lee Chang-dong","Bong Joon-ho","Kim Jee-woon"],2,"He also directed “Snowpiercer” and “Memories of Murder.”"),
  q("k12","Korean Cinema","Which Korean film became the first non-English-language film to win the Academy Award for Best Picture?",["Oldboy","Parasite","The Handmaiden","Burning"],1,"The story follows two families living very different lives."),
  q("k13","Korean Cinema","Where does most of “Train to Busan” take place?",["On a ship","In an airport","On a high-speed train","Inside a hospital"],2,"The destination is already contained in the title."),
  q("k14","Korean Cinema","Who directed the revenge thriller “Oldboy”?",["Bong Joon-ho","Park Chan-wook","Hwang Dong-hyuk","Yeon Sang-ho"],1,"He also directed “The Handmaiden.”"),
  q("k15","Korean Cinema","Which pair of films was directed by Park Chan-wook?",["Parasite and Minari","Oldboy and The Handmaiden","Train to Busan and Burning","The Host and Decision to Leave"],1,"One is a revenge thriller and the other is an elaborate period drama."),
  q("k16","Korean Cinema","Which description best matches “Minari”?",["A detective investigates a serial killer in Seoul","A Korean-American family starts a farm in rural Arkansas","A group survives a zombie outbreak on a train","A poor family enters the home of a wealthy family"],1,"The story centres on family, migration and building a new home."),
  q("k17","K-Drama","Who created “Squid Game”?",["Hwang Dong-hyuk","Bong Joon-ho","Park Chan-wook","Yeon Sang-ho"],0,"He also directed the series."),
  q("k18","K-Drama","Which description best matches “Crash Landing on You”?",["A lawyer joins an unusual law firm","A South Korean heiress accidentally lands in North Korea","Students become trapped during a zombie outbreak","A hotel welcomes supernatural guests"],1,"The central journey crosses the border between South and North Korea."),
  q("k19","K-Drama","What is Woo Young-woo’s profession in “Extraordinary Attorney Woo”?",["Doctor","Journalist","Attorney","Music producer"],2,"The profession appears directly in the title."),
  q("k20","K-Drama","Which description best matches “Kingdom”?",["A modern romance inside a music company","Joseon-era political conflict combined with a zombie outbreak","A school competition for young singers","A courtroom drama about corporate crime"],1,"It combines historical royal politics with horror."),
];

export function getQuestionBank(id: QuizId) {
  return id === "millionaire" ? millionaireQuestions : kcultureQuestions;
}

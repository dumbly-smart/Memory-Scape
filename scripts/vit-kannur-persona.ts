export type PersonaContextType = 'Person' | 'Place' | 'Topic' | 'Activity' | 'Project' | 'Emotion' | 'Event' | 'Custom';

export interface PersonaContext {
  key: string;
  type: PersonaContextType;
  label: string;
}

export interface PersonaLocation {
  label: string;
  longitude: number;
  latitude: number;
}

export interface PersonaMemory {
  key: string;
  title: string;
  content: string;
  occurredAt: string;
  locationKey: string;
  contexts: string[];
  strength: number;
  decayRate: number;
}

export interface PersonaEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  valence: number;
}

export interface VitKannurPersona {
  key: string;
  version: number;
  name: string;
  description: string;
  contexts: PersonaContext[];
  locations: Record<string, PersonaLocation>;
  memories: PersonaMemory[];
  edges: PersonaEdge[];
}

const contexts: PersonaContext[] = [
  ['self', 'Person', 'Nikhil P. (fictional student)'],
  ['amma', 'Person', 'Anitha (mother)'], ['achan', 'Person', 'Pradeep (father)'],
  ['sister', 'Person', 'Meera (younger sister)'], ['grandmother', 'Person', 'Ammaamma (grandmother)'],
  ['roommate', 'Person', 'Rohit (roommate)'], ['friend_sana', 'Person', 'Sana (close friend)'],
  ['friend_joel', 'Person', 'Joel (football friend)'], ['mentor', 'Person', 'Dr. Rao (faculty mentor)'],
  ['team', 'Person', 'Database project group'], ['home', 'Place', 'Family home, Kannur'],
  ['vit', 'Place', 'VIT Vellore campus'], ['library', 'Place', 'Gandhi Block library, VIT'],
  ['hostel', 'Place', 'Men’s hostel, VIT Vellore'], ['katpadi', 'Place', 'Katpadi Junction'],
  ['kannur_station', 'Place', 'Kannur railway station'], ['payyambalam', 'Place', 'Payyambalam Beach, Kannur'],
  ['mappila_bay', 'Place', 'Mappila Bay, Kannur'], ['vellore_market', 'Place', 'Vellore town market'],
  ['coorg', 'Place', 'Madikeri, Coorg'], ['mysuru', 'Place', 'Mysuru'], ['wayanad', 'Place', 'Wayanad'],
  ['kozhikode', 'Place', 'Kozhikode'], ['cbe', 'Place', 'Coimbatore'],
  ['cse', 'Topic', 'Computer science studies'], ['db', 'Topic', 'Database systems and PostgreSQL'],
  ['algorithms', 'Topic', 'Algorithms and problem solving'], ['web', 'Topic', 'Web development'],
  ['photography', 'Topic', 'Photography'], ['music', 'Topic', 'Malayalam music'],
  ['football', 'Activity', 'Football'], ['badminton', 'Activity', 'Badminton'], ['cooking', 'Activity', 'Cooking'],
  ['reading', 'Activity', 'Reading for pleasure'], ['walking', 'Activity', 'Long walks'],
  ['budget', 'Activity', 'Budget-conscious travel'], ['journaling', 'Activity', 'Personal reflection'],
  ['study', 'Activity', 'Studying and coursework'], ['friends', 'Activity', 'Time with friends'],
  ['family', 'Activity', 'Family time'], ['travel', 'Activity', 'Train travel'],
  ['project', 'Project', 'MemoryScape course project'], ['club', 'Project', 'Campus football group'],
  ['onam', 'Event', 'Onam holiday'], ['vishu', 'Event', 'Vishu holiday'], ['christmas', 'Event', 'Christmas break'],
  ['summer', 'Event', 'Summer vacation'], ['semester', 'Event', 'Semester routine'],
  ['exams', 'Event', 'End-semester exams'], ['vacation', 'Event', 'Family vacation'],
  ['homesick', 'Emotion', 'Homesickness'], ['curious', 'Emotion', 'Curiosity'], ['proud', 'Emotion', 'Pride'],
  ['stress', 'Emotion', 'Academic stress'], ['grateful', 'Emotion', 'Gratitude'], ['lonely', 'Emotion', 'Loneliness'],
  ['joy', 'Emotion', 'Joy'], ['calm', 'Emotion', 'Calm'], ['determined', 'Emotion', 'Determination'],
  ['personal', 'Custom', 'Personal growth and values'], ['sleep', 'Custom', 'Sleep and wellbeing'],
  ['persona', 'Custom', 'Synthetic persona: Nikhil P. (fictional)'],
].map(([key, type, label]) => ({ key, type: type as PersonaContextType, label }));

const locations: Record<string, PersonaLocation> = {
  'vit-campus': { label: 'VIT Vellore campus (approximate)', longitude: 79.1559, latitude: 12.9698 },
  'vit-library': { label: 'Gandhi Block library, VIT (approximate)', longitude: 79.1571, latitude: 12.9704 },
  'vit-hostel': { label: 'VIT men’s hostel (approximate)', longitude: 79.1602, latitude: 12.9712 },
  'vit-ground': { label: 'VIT sports ground (approximate)', longitude: 79.1515, latitude: 12.9668 },
  'vellore-town': { label: 'Vellore town (approximate)', longitude: 79.1325, latitude: 12.9165 },
  'katpadi': { label: 'Katpadi Junction (approximate)', longitude: 79.1324, latitude: 12.9692 },
  'train-salem': { label: 'Salem Junction, en route home (approximate)', longitude: 78.1430, latitude: 11.6643 },
  'train-coimbatore': { label: 'Coimbatore Junction, en route home (approximate)', longitude: 76.9674, latitude: 10.9975 },
  'train-kozhikode': { label: 'Kozhikode, en route home (approximate)', longitude: 75.7804, latitude: 11.2480 },
  'kannur-station': { label: 'Kannur railway station (approximate)', longitude: 75.3704, latitude: 11.8745 },
  'kannur-home': { label: 'Family home, Kannur (fictional approximate location)', longitude: 75.3718, latitude: 11.8910 },
  'payyambalam': { label: 'Payyambalam Beach, Kannur (approximate)', longitude: 75.3570, latitude: 11.8765 },
  'mappila-bay': { label: 'Mappila Bay, Kannur (approximate)', longitude: 75.3690, latitude: 11.8615 },
  'coorg': { label: 'Madikeri, Coorg (approximate)', longitude: 75.7382, latitude: 12.4244 },
  'mysuru': { label: 'Mysuru (approximate)', longitude: 76.6394, latitude: 12.2958 },
  'wayanad': { label: 'Wayanad (approximate)', longitude: 76.1320, latitude: 11.6854 },
  'kozhikode': { label: 'Kozhikode (approximate)', longitude: 75.7804, latitude: 11.2588 },
};

type Draft = Omit<PersonaMemory, 'key' | 'strength' | 'decayRate'> & { strength?: number; decayRate?: number };

const episodes: Draft[] = [
  { title: 'First evening at VIT, trying to sound braver than I felt', content: 'I unpacked in the hostel while Amma kept asking if I had eaten. The campus felt enormous and the room smelled of fresh paint. I told my parents I was excited, then admitted to my journal that I was also scared of being far from Kannur. Rohit introduced himself by lending me a phone charger; that tiny kindness made the room feel less strange.', occurredAt: '2024-07-18T18:30:00+05:30', locationKey: 'vit-hostel', contexts: ['self','vit','hostel','amma','roommate','homesick','personal'] },
  { title: 'Orientation walk and the first route I learned by heart', content: 'Sana showed me the route from the hostel to the library, food court and academic blocks. I took photos of the trees and landmarks because I remember places better when I can connect them to a story. I was quiet in the group at first, but people waited for me instead of rushing ahead.', occurredAt: '2024-07-21T16:00:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','friend_sana','walking','photography','friends','curious'] },
  { title: 'My first VIT lecture: understood half, wrote down everything', content: 'The professor moved quickly through the first programming lecture. I did not understand every example, but I wrote questions in the margin instead of pretending. Joel shared his notes after class. I want to be the kind of engineer who asks clear questions and helps other people catch up too.', occurredAt: '2024-07-24T10:00:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','cse','study','friend_joel','curious','personal'] },
  { title: 'A call home after the noisy first week', content: 'I called home from the hostel corridor because it was the only quiet spot. Meera teased me about my homesick voice, then asked me to send campus photos. Achan said the point was to build a life here without losing the one I came from. I wrote that down.', occurredAt: '2024-07-27T21:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','hostel','home','achan','sister','homesick','family'] },
  { title: 'Found a quiet library seat and finally focused', content: 'The library gave me a corner where I could read without checking my phone every two minutes. I made a weekly study plan, with breaks and football rather than a heroic schedule I would abandon. Keeping promises to myself feels more useful than studying until midnight.', occurredAt: '2024-08-06T17:00:00+05:30', locationKey: 'vit-library', contexts: ['self','library','study','algorithms','sleep','determined','personal'] },
  { title: 'First football evening with Joel', content: 'I joined Joel for a casual game. I am not the best player, but running outside cleared the pressure from a week of new classes. We agreed that playing badly together is still better than staying in the room doom-scrolling.', occurredAt: '2024-08-10T18:00:00+05:30', locationKey: 'vit-ground', contexts: ['self','football','friend_joel','club','friends','joy','sleep'] },
  { title: 'Learning to budget in Vellore', content: 'I wrote down food, laundry, travel and snack spending for the first time. Vellore is manageable if I plan ahead, but small impulse buys add up. Achan taught me to keep a little emergency money separate. I am trying to be careful without making every outing feel forbidden.', occurredAt: '2024-08-16T20:00:00+05:30', locationKey: 'vellore-town', contexts: ['self','vellore_market','budget','achan','personal','determined'] },
  { title: 'Onam trip home: the train made the distance feel real', content: 'I caught the train from Katpadi for the Onam break. At Salem, the landscape began to look more familiar and I started sending photos to Amma. By the time I got to Kannur I was tired and ridiculously happy. The best part was seeing everyone at the door and smelling the sadhya preparations.', occurredAt: '2024-09-13T07:10:00+05:30', locationKey: 'train-salem', contexts: ['self','travel','katpadi','home','onam','family','joy'] },
  { title: 'Onam morning with the whole family', content: 'We ate sadhya slowly, with Ammaamma telling the same funny story about Achan as a boy. I helped Meera arrange flowers, though she corrected my design. I like how home holidays make even an ordinary meal feel like an event everyone helped create.', occurredAt: '2024-09-15T12:30:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','onam','family','grandmother','sister','cooking','grateful'] },
  { title: 'Payyambalam walk before going back to campus', content: 'Amma and I walked by the sea early, before the beach filled up. I told her I was enjoying college but missed the sounds of home. She listened without turning it into advice. I took a photo of the grey-blue water to keep for a hard day.', occurredAt: '2024-09-17T06:45:00+05:30', locationKey: 'payyambalam', contexts: ['self','payyambalam','amma','walking','photography','homesick','calm'] },
  { title: 'The return journey: home in my bag, classes on my mind', content: 'I boarded at Kannur with snacks Amma packed and a list of work to do after I got back. I listened to Malayalam songs and watched the route north to south unfold. I am learning that missing home and wanting to return to campus can both be true.', occurredAt: '2024-09-20T08:00:00+05:30', locationKey: 'train-coimbatore', contexts: ['self','travel','home','vit','music','personal','calm'] },
  { title: 'A debugging session that taught me patience', content: 'My program failed because I assumed the input would always be well formed. Sana asked me to explain the assumption out loud; once I did, the bug was obvious. I want to get better at listening to what the code is actually doing instead of defending my first guess.', occurredAt: '2024-10-03T19:00:00+05:30', locationKey: 'vit-library', contexts: ['self','library','cse','algorithms','friend_sana','curious','determined'] },
  { title: 'First end-semester exam nerves', content: 'I felt behind even though I had followed the plan. I called Achan, who reminded me of the time I learned to ride a bicycle: small practice beats panic. I slept before midnight and went in with a short list of concepts, not a fantasy of revising everything.', occurredAt: '2024-11-20T22:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','hostel','exams','achan','stress','sleep','determined'] },
  { title: 'Winter break and a conversation with Ammaamma', content: 'Back in Kannur for the break, I helped Ammaamma with her phone and heard how she remembers every family trip by the food we ate. I realised my own photos are becoming a map of people I miss. We talked about choosing work that leaves room for family.', occurredAt: '2024-12-24T17:00:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','christmas','grandmother','photography','family','personal'] },
  { title: 'A quiet new-year promise, not a resolution list', content: 'I wrote three things I want more of: sleep, honest conversations, and making things with friends. I do not need to become a different person this year. I want to be more consistent about the person I already hope to be.', occurredAt: '2025-01-01T09:30:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','journaling','personal','sleep','calm'] },
  { title: 'Back at VIT with a better weekly rhythm', content: 'The first week back was busy, but the room felt familiar now. I put classes, library blocks, laundry and football into one weekly plan. I left one evening unplanned because rest should not have to earn its place.', occurredAt: '2025-01-13T20:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','vit','hostel','semester','study','football','sleep'] },
  { title: 'The database assignment finally made sense', content: 'I used small tables to understand joins before trying the full assignment. The library whiteboard helped me see why a foreign key is a promise between tables, not just a column. I explained the diagram to Rohit and noticed I understood it better after teaching it.', occurredAt: '2025-02-06T18:00:00+05:30', locationKey: 'vit-library', contexts: ['self','library','db','cse','roommate','curious','proud'] },
  { title: 'Vishu morning at home on a video call', content: 'I could not travel for Vishu this time, so the family called me before breakfast. Amma showed me the kani and Meera kept moving the camera to make me laugh. I felt a little left out, then grateful that they made space for me on the call.', occurredAt: '2025-04-14T08:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','hostel','vishu','home','amma','sister','homesick','grateful'] },
  { title: 'Project idea formed over tea after class', content: 'Our group kept talking about how a place can bring back a memory. Dr. Rao suggested we make the database do the spatial work rather than bury it in the interface. I went back to the hostel excited and slightly intimidated by the scope.', occurredAt: '2025-05-08T17:30:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','mentor','team','project','db','curious','stress'] },
  { title: 'First proper project review with Dr. Rao', content: 'We showed the schema and got useful questions about what strength means and how route ordering should work. I wrote down every question instead of treating critique as failure. The project is clearer now because someone challenged our assumptions.', occurredAt: '2025-06-12T16:30:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','mentor','team','project','db','determined','proud'] },
  { title: 'Summer vacation starts with the long ride north', content: 'The summer trip took most of a day. At Kozhikode, I recognised the coast and stopped listening to my playlist for a while. Achan met me at Kannur station; neither of us said much on the drive home, which was comfortable in its own way.', occurredAt: '2025-06-28T18:15:00+05:30', locationKey: 'kannur-station', contexts: ['self','travel','summer','home','achan','joy','family'] },
  { title: 'A family drive through Wayanad', content: 'We took the winding road into Wayanad, stopping whenever Amma saw a view she liked. Meera picked the music and I took photos without trying to make every frame perfect. I love travelling with family because the small delays become the story later.', occurredAt: '2025-07-15T11:00:00+05:30', locationKey: 'wayanad', contexts: ['self','wayanad','vacation','family','sister','photography','budget','joy'] },
  { title: 'Late-night cooking experiment with Meera', content: 'We tried making a quick snack from leftovers and made a mess of the kitchen. Amma pretended to be annoyed until she tasted it. I miss this kind of unplanned time when the semester gets busy.', occurredAt: '2025-07-29T20:30:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','cooking','sister','family','joy'] },
  { title: 'Back at campus after a summer that reset me', content: 'I returned to Vellore rested, with a few good photos and a slightly better sense of what I want from the project. The train journey was long, but I used it to sketch the relationships between memories. I want the software to feel useful to an ordinary person, not only impressive in a demo.', occurredAt: '2025-08-10T15:00:00+05:30', locationKey: 'katpadi', contexts: ['self','vit','travel','project','journaling','personal','determined'] },
  { title: 'Our group chose a smaller, clearer project milestone', content: 'We cut features that sounded clever but did not help a real user. Sana made the interface sketch easier to follow and I simplified the SQL experiment. Saying no to a bigger scope felt uncomfortable, then relieving.', occurredAt: '2025-09-03T18:00:00+05:30', locationKey: 'vit-library', contexts: ['self','library','team','project','friend_sana','db','calm'] },
  { title: 'Onam in Vellore with friends who became my campus family', content: 'I could not go home for the full Onam break, so a few of us made a small meal in the hostel common area. Joel found banana leaves and Sana called her family to check the recipe. It was not the same as Kannur, but it felt generous and real.', occurredAt: '2025-09-06T13:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','hostel','onam','friends','friend_sana','friend_joel','cooking','homesick'] },
  { title: 'A small win after two stubborn SQL bugs', content: 'The recursive query finally returned a useful path and stopped revisiting nodes in a cycle. I took a screenshot for the project notes, then went outside instead of polishing it for another hour. I am proud of the work and also learning when to stop.', occurredAt: '2025-10-10T19:30:00+05:30', locationKey: 'vit-library', contexts: ['self','library','project','db','team','proud','sleep'] },
  { title: 'I handled exam stress better this semester', content: 'I still felt nervous, but I used short revision blocks, ate properly and asked the professor one question early. The exam was not perfect. It also was not a verdict on who I am. I want to remember that distinction next time.', occurredAt: '2025-11-22T20:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','hostel','exams','study','stress','mentor','personal'] },
  { title: 'Christmas trip to Kannur and the comfort of familiar roads', content: 'I took the overnight train south and woke near the coast. At home, Amma had kept dinner warm and Meera had made a list of places she wanted us to go. I had been counting down the days more than I admitted.', occurredAt: '2025-12-20T19:30:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','christmas','travel','family','homesick','joy'] },
  { title: 'Mappila Bay sunset with Achan', content: 'Achan and I walked near the harbour and talked about internships, but mostly about his first job. I realised I value his steadiness more than his advice. We watched the boats come in and did not rush home.', occurredAt: '2025-12-27T17:15:00+05:30', locationKey: 'mappila-bay', contexts: ['self','mappila_bay','achan','walking','family','personal','calm'] },
  { title: 'Mysuru weekend: travel on a student budget', content: 'A small group planned the bus and stay carefully so the weekend stayed affordable. We walked around Mysuru, shared snacks and left room for getting lost. I like trips where the plan is practical but the day still has surprises.', occurredAt: '2026-01-18T15:00:00+05:30', locationKey: 'mysuru', contexts: ['self','mysuru','vacation','budget','friends','photography','joy'] },
  { title: 'Choosing a project role that fits how I work', content: 'I told the team I am strongest at database design and careful debugging, and less confident presenting without preparation. We divided work around strengths while everyone still learned the other parts. Being honest made collaboration easier.', occurredAt: '2026-02-03T17:00:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','team','project','personal','determined','friends'] },
  { title: 'A phone-free walk after a long week', content: 'I left my phone in the room and walked around campus with no destination. The trees and evening light slowed my thoughts down. I have been treating every free minute as time I should optimise; this felt like permission to just notice things.', occurredAt: '2026-02-21T18:00:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','walking','sleep','calm','personal'] },
  { title: 'Vishu at home, and why the small rituals matter', content: 'I made it home for Vishu. Ammaamma showed me how she arranges the kani, and Meera insisted on taking a family photo before anyone touched breakfast. The ritual made the year feel connected to the people who raised me.', occurredAt: '2026-04-14T07:00:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','vishu','grandmother','family','sister','photography','grateful'] },
  { title: 'A difficult project conversation that ended well', content: 'We disagreed about whether to add another feature before testing the core flow. I started out defensive, then repeated Sana’s concern back to make sure I understood it. We chose a smaller testable version and kept the conversation kind.', occurredAt: '2026-05-05T19:00:00+05:30', locationKey: 'vit-library', contexts: ['self','library','project','team','friend_sana','personal','calm'] },
  { title: 'Summer homecoming and a promise to make time for people', content: 'The semester ended and I took the train back to Kannur. I had spent months saying I would call more often once work calmed down. I want to be more deliberate: a short regular call is better than waiting for the perfect free evening.', occurredAt: '2026-06-24T19:00:00+05:30', locationKey: 'kannur-station', contexts: ['self','home','summer','travel','family','personal','grateful'] },
  { title: 'Coorg trip: mist, bad phone signal, good company', content: 'We went to Madikeri with family and spent more time walking than sightseeing. When the signal disappeared, I stopped checking messages and paid attention to the mist and everyone’s stories. I took fewer photos and remember the day more clearly.', occurredAt: '2026-07-11T10:30:00+05:30', locationKey: 'coorg', contexts: ['self','coorg','vacation','family','walking','photography','calm','joy'] },
  { title: 'A long conversation with Meera about choosing a path', content: 'Meera asked if computer science is always competitive. I told her I like solving problems, but I do not want achievement to become my whole personality. We talked about curiosity, kindness and having a life outside grades.', occurredAt: '2026-07-26T21:00:00+05:30', locationKey: 'kannur-home', contexts: ['self','home','sister','family','personal','cse','grateful'] },
  { title: 'Returning for the new semester with a clearer head', content: 'I got back to VIT before classes and unpacked slowly. I miss home, but I also feel ready to build the next part of the year. I put my family photo beside the desk and made a realistic first-week plan.', occurredAt: '2026-08-07T18:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','vit','hostel','travel','homesick','determined','personal'] },
  { title: 'A semester project demo that felt like our own work', content: 'The route recall demo worked and we could explain why each result appeared. The feedback was specific instead of polite, which I appreciated. I was nervous speaking, but knowing the SQL made it easier to answer questions honestly.', occurredAt: '2026-09-20T16:00:00+05:30', locationKey: 'vit-campus', contexts: ['self','vit','project','team','mentor','db','proud','stress'] },
  { title: 'An ordinary Sunday that reminded me I am settling in', content: 'I did laundry, played football, called home and read for half an hour. Nothing would make a dramatic story, but the day felt balanced. Vellore no longer feels like a place I am borrowing; it is part of my life too.', occurredAt: '2026-10-18T20:00:00+05:30', locationKey: 'vit-hostel', contexts: ['self','vit','hostel','football','family','reading','calm','grateful'] },
];

const monthlyReflections = [
  { title: 'Small study routine, less last-minute panic', content: 'I reviewed lecture notes in short blocks and wrote down the one question I still had. The routine is ordinary, but it keeps work from becoming a late-night emergency. I am trying to measure a good week by consistency, not by how exhausted I feel.', contexts: ['study','cse','determined','sleep'] },
  { title: 'A campus evening with people who make Vellore feel familiar', content: 'I spent the evening with friends after classes. We traded stories, joked about our assignment mistakes and walked back slowly. I value friends who make room for serious conversations and silly ones in the same hour.', contexts: ['friends','friend_sana','friend_joel','walking','joy'] },
  { title: 'Project notes and a reminder to ask for feedback early', content: 'I made progress on the database project, but a quiet doubt stayed with me until I showed the team. Talking it through surfaced a simpler solution. I am learning that asking early is a form of responsibility, not a sign I have failed.', contexts: ['project','team','db','curious','personal'] },
  { title: 'Taking care of sleep before the busy stretch', content: 'I noticed I was getting irritable after too many late nights. I reset my schedule, put the phone away earlier and did a short walk before dinner. Taking care of my body is part of doing good work and being a good friend.', contexts: ['sleep','walking','personal','calm'] },
  { title: 'A small football game that cleared my head', content: 'We played a casual game and laughed more than we kept score. Exercise made the pending work feel manageable again. I want to keep one activity that is just for enjoyment, even during exams.', contexts: ['football','friend_joel','friends','joy','sleep'] },
  { title: 'Checking in with home instead of waiting to miss it', content: 'I called Amma and Achan for a few minutes and told them what my week was actually like. We talked about ordinary things. Staying close does not always require a holiday or a long conversation; sometimes it is simply showing up regularly.', contexts: ['family','amma','achan','home','grateful'] },
];

function parseMonth(date: Date): string {
  return date.toLocaleString('en', { month: 'long', timeZone: 'UTC' });
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function buildVitKannurPersona(): VitKannurPersona {
  const memories: PersonaMemory[] = episodes.map((episode, index) => ({
    ...episode,
    key: `episode-${String(index + 1).padStart(3, '0')}`,
    contexts: ['persona', ...episode.contexts],
    strength: round(0.52 + ((index * 17) % 46) / 100),
    decayRate: round(0.002 + ((index * 11) % 28) / 10000),
  }));

  // Three modest, distinct routines per month give timeline and decay studies enough history
  // without pretending that every day was exceptional. Dates are UTC and stop in Oct 2026.
  let routineIndex = 0;
  for (let year = 2024; year <= 2026; year += 1) {
    const firstMonth = year === 2024 ? 7 : 1;
    const lastMonth = year === 2026 ? 10 : 12;
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      const monthDate = new Date(Date.UTC(year, month - 1, 1));
      const inKannur = (year === 2024 && month === 9) || (year === 2024 && month === 12)
        || (year === 2025 && [6, 7, 12].includes(month)) || (year === 2026 && [4, 6, 7].includes(month));
      for (let slot = 0; slot < 3; slot += 1) {
        const reflection = monthlyReflections[(routineIndex + slot) % monthlyReflections.length];
        const date = new Date(Date.UTC(year, month - 1, [4, 13, 23][slot], [15, 18, 20][slot], 30));
        const phase = monthDate.getUTCMonth();
        const placeKey = inKannur
          ? (slot === 1 && (phase === 6 || phase === 11) ? 'payyambalam' : 'kannur-home')
          : (slot === 0 ? 'vit-library' : slot === 1 ? 'vit-campus' : 'vit-hostel');
        const seasonContext = inKannur ? (phase === 3 ? 'vishu' : phase === 8 ? 'onam' : phase === 11 ? 'christmas' : 'summer') : 'semester';
        memories.push({
          key: `routine-${year}-${String(month).padStart(2, '0')}-${slot + 1}`,
          title: `${reflection.title} · ${parseMonth(monthDate)} ${year}`,
          content: `${reflection.content} This note belongs to my ${parseMonth(monthDate)} ${year} rhythm. I was at ${inKannur ? 'home in Kannur, spending a holiday with family' : 'VIT Vellore, balancing classes and hostel life'}.`,
          occurredAt: date.toISOString(),
          locationKey: placeKey,
          contexts: ['persona', 'self', seasonContext, ...(inKannur ? ['home', 'family'] : ['vit']), ...reflection.contexts],
          strength: round(0.48 + ((year * month + slot * 13) % 45) / 100),
          decayRate: round(0.002 + ((year + month * 3 + slot * 7) % 26) / 10000),
        });
      }
      routineIndex += 1;
    }
  }

  memories.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.key.localeCompare(b.key));
  const edges: PersonaEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (source: string, target: string, type: string, weight: number, valence: number) => {
    if (source === target) return;
    const identity = `${source}|${target}|${type}`;
    if (edgeKeys.has(identity)) return;
    edgeKeys.add(identity);
    edges.push({ source, target, type, weight: round(weight), valence: round(valence) });
  };

  // Narrative sequence plus nearby memories sharing stable contexts form an interpretable graph.
  for (let index = 1; index < memories.length; index += 1) {
    const previous = memories[index - 1];
    const current = memories[index];
    addEdge(previous.key, current.key, 'Happened before', 0.72, 0.18);
    const shared = current.contexts.filter((key) => previous.contexts.includes(key) && !['self', 'semester'].includes(key));
    if (shared.length) {
      const relation = shared.includes('home') || shared.includes('family') ? 'Same person' : shared.includes('project') || shared.includes('db') ? 'Related topic' : 'Reminds me of';
      addEdge(previous.key, current.key, relation, 0.54 + Math.min(shared.length, 4) * 0.08, shared.includes('homesick') || shared.includes('stress') ? -0.45 : 0.62);
    }
  }
  // Longer associative links help demonstrate multi-hop recall and route/holiday stories.
  const byContext = new Map<string, PersonaMemory[]>();
  for (const memory of memories) for (const key of memory.contexts) {
    const list = byContext.get(key) ?? [];
    list.push(memory);
    byContext.set(key, list);
  }
  for (const [context, related] of byContext) {
    const step = context === 'self' ? 0 : context === 'family' || context === 'project' ? 2 : 4;
    if (step === 0) continue;
    for (let index = 0; index + step < related.length; index += Math.max(3, Math.floor(related.length / 10))) {
      const left = related[index];
      const right = related[index + step];
      addEdge(left.key, right.key, context === 'home' || context === 'family' ? 'Same person' : context === 'vit' ? 'Same location' : 'Reminds me of',
        context === 'family' ? 0.78 : 0.61, context === 'homesick' ? -0.7 : context === 'stress' ? -0.35 : 0.55);
    }
  }

  return {
    key: 'vit-kannur-student-v1',
    version: 1,
    name: 'Nikhil P. (fictional)',
    description: 'A fictional, privacy-safe VIT Vellore computer-science undergraduate whose family home is in Kannur. Curious and methodical, values family, loyal friendships, sleep, football and affordable travel; sometimes homesick and exam-stressed, but reflective and steadily growing more independent. Memories span Jul 2024–Oct 2026 and include term routines, train journeys, Onam/Vishu/Christmas/summer breaks, vacations and course/project life.',
    contexts,
    locations,
    memories,
    edges,
  };
}

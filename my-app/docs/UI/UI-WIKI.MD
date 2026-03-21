https://www.userinterface.wiki/Laws of UX


Feb 17, 2026 by Raphael Salaja
Every interface I've ever used that felt right had something in common, they always respect how I actually think. Not how a spec says I should think, but how my brain actually works. Deeper reasearch revels that there's a bunch of psychology behind this.
Researchers have been studying it for decades. In this post, I'm not going to cover all of it, just the laws I find myself coming back to the most and find the most useful to keep in mind when building interfaces.
Fitts's Law
The time required to move to a target is a function of the target's size and distance from the starting point.1
The bigger something is, the easier it is to click. This one is pretty obvious, but it's something that's easy to overlook when building.
5 / 12
Fitts's Law Experiment
The experiment above should prove the above statement. It's pretty easy to hit something that's larger. But when you're dealing with small targets, you need to be more precise. This matters a lot when you're building. Always think about the hit area of your interactive elements.




Above I'm using ::before to expand the hit area of a button. The user can't see the extra padding, but it's there and it's easy to click. Every pixel of padding on a button is a usability decision. Make the things people need to click easy to click.
Sidenote, this concept can also be seen somewhat in games. In platformers, there's a trick called "coyote time" where the game lets you jump for a few frames after you've already walked off a ledge. You're technically in the air, but the game pretends you're still on solid ground.

Coyote Time - Celeste2
Same principle as expanding a button's hit area. Instead of making a spatial target bigger, you're making a temporal target bigger. The user doesn't notice the forgiveness. They just feel like the system works.
Hick's Law
The time it takes to make a decision increases with the number and complexity of choices.3
More options, more cognitive load. And it's not linear, it's logarithmic. Going from 2 to 4 choices is noticeable. Going from 8 to 16 is painful.
Find
Olive
6529ms
Hick's Law Experiment
Finding a word among 4 options is easy. Now try it with 24, each printed in the wrong color. That hesitation you feel is Hick's Law.
This doesn't mean you should always minimize choices. Sometimes people need options. The key is progressive disclosure. Show what matters now, reveal complexity when it's needed.
Restaurant menus understand this intuitively. The best ones don't list 200 dishes. They curate what you think should be seen. Your interface should too.
Miller's Law
The average person can hold about 7 (plus or minus 2) items in working memory at any given time.4
Whenever you're dealing with a lot of data, you need to chunk it or group it in a way that makes sense to the user. Showing them blobs of text is the worst thing you can do. It's like trying to find a needle in a haystack of junk.
Phone

Raw vs. Readable
The raw data is identical to the chunked version. Your brain processes them completely differently. Chunking isn't a nice-to-have, I think it's a cognitive necessity.
Doherty Threshold
Productivity soars when a computer and its users interact at a pace that ensures neither has to wait on the other. The threshold is 400 milliseconds.5
Under 400ms, interactions feel instant. Above it, you notice. Way above it, you start wondering if something broke.
Instant (<100ms)
Threshold (<400ms)
Broken (>2000ms)
Click each button to feel the difference.
The 100ms response feels like the button is an extension of your hand. 400ms is barely noticeable. 2000ms feels broken, even though it does exactly the same thing.
If you can't make something fast, make it feel fast. Optimistic UI, skeleton screens, progress indicators, they all exist because perceived speed matters as much as actual speed. The best interactions are the ones where you never think about speed at all.
Postel's Law
Be conservative in what you send, be liberal in what you accept.6
This was originally a networking principle from RFC 761, but it translates perfectly to interface design. Your inputs should accept messy human data and normalize it into clean output.


Try entering dates in any format.
Users don't think in formats. They think in meaning. When someone types "jan 15 2024" they mean the same thing as "2024-01-15". Your interface should understand that.
The more formats you accept, the less friction people experience. Validate generously, format strictly.
Looking Back
I keep coming back to these laws because they're not really about interfaces. They're about how people work. How we perceive time, how we make decisions, how much we can hold in our heads at once.
You don't need to memorize any of this. Just pay attention to how things feel when you use them. At the end of the day, the hardest thing to do is make something feel easy, and that's what were trying to achieve.
If you want to dive deeper into all of this, check out Laws of UX by Jon Yablonski. It covers way more than what I've touched on here.
//
—
Animating Container Bounds


Feb 9, 2026 by Raphael Salaja
Have you ever tried to animate a container's width or height with Motion and run into this?


The one on the left just snaps to its new size. The text animates in fine, but the container itself jumps. That's because width and height are not animatable. The browser doesn't know how to interpolate between a fixed value and "whatever the content needs."
The one on the right is way smoother and feels better. Same content change, but the width animates to fit. So how do we achieve this?
Building a useMeasure Hook
Before we get into the animation part, we need a way to track an element's dimensions. The browser has a native API for this called ResizeObserver.1 It watches an element and fires a callback whenever its size changes. We can wrap this in a small hook.
import { useCallback, useEffect, useState } from "react";

function useMeasure() {
  const [element, setElement] = useState(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const ref = useCallback((node) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds];
}
The hook returns a ref callback and a bounds object. Attach the ref to any element and bounds will always reflect its current width and height. When the content inside that element changes and causes a resize, the observer fires, state updates, and your component re-renders with the new values.
There are libraries like react-use-measure that do this too, but as you can see it's only a few lines of code. No dependency needed.2
Integrating with Motion
Now for the animation. The core idea is two divs. An outer div that you animate, and an inner div that you measure. Attach the ref from useMeasure to the inner div, the hook gives you bounds.width and bounds.height which update whenever the content changes, pass those values to Motion's animate prop on the outer div.
import { motion } from "motion/react";

function AnimatedContainer({ children }) {
  const [ref, bounds] = useMeasure();

  return (
    <motion.div animate={{ height: bounds.height }}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
Animating Width
Buttons that change their label are a common use case. Loading states, confirmation messages, multi-step forms. Without animated bounds the button jumps between widths. With this pattern, it slides.
Code Playground




25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
import { MotionConfig, type MotionProps, motion } from "motion/react";

  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds];
}

const labels = ["Lorem Ipsum", "Ex Amet", "Aliqua Velit"];

export default function App() {
  const [index, setIndex] = useState(0);
  const [ref, bounds] = useMeasure();

  function handleClick() {
    setIndex((prev) => (prev + 1) % labels.length);
  }

  return (
    <div className={styles.container}>
      <MotionConfig
        transition={{
          duration: 0.4,
          ease: [0.19, 1, 0.22, 1],
          delay: 0.05,
        }}
      >
        <motion.button
          animate={{
            width: bounds.width > 0 ? bounds.width : "auto",
          }}
          onClick={handleClick}
          className={styles.button}
        >
          <div ref={ref} className={styles.wrapper}>
            <motion.span
              {...animation}
              key={labels[index]}
              className={styles.label}
            >
              {labels[index]}
            </motion.span>
          </div>
        </motion.button>
      </MotionConfig>
    </div>
  );
}

The trick here is the ref goes on the inner wrapper, not the button itself. The button's width is controlled by Motion. The wrapper's width is controlled by its content. When the content changes, the measured width updates, and the button smoothly resizes to fit.
One thing to note is that I'm checking bounds.width > 0 before animating. This avoids an animation from 0 on the initial render. You want the first frame to just show the button at its natural size, not animate in from nothing.
Animating Height
Height is where this pattern really shines. Expandable sections, accordions, FAQs, details panels. Anywhere content reveals or hides itself.
The same pattern applies. Measure the inner content, animate the outer container.
Code Playground




1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import styles from "./styles.module.css";

function useMeasure<T extends HTMLElement = HTMLElement>(): [
  (node: T | null) => void,
  { width: number; height: number },
] {
  const [element, setElement] = useState<T | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds];
}

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [ref, bounds] = useMeasure();


When items are added or removed, the measured height changes and the animation follows. Works for any dynamic content, text, images, lists, nested components.
Gotchas
On initial render, bounds.width and bounds.height will be 0 before the first measurement. Guard against this or you'll get an animation from 0 to the actual size on mount. A simple bounds.height > 0 ? bounds.height : "auto" works.
Don't measure and animate the same element. The ref goes on the inner div, the animate prop goes on the outer div. If you put both on the same element you create a loop, the animation changes the size, which triggers a new measurement, which triggers a new animation.
Add a small delay to the animation to give the feel of a natural transition catching up to the content.
Finally, don't overuse this pattern. It's a subtle effect that should be used sparingly. Use it when it makes sense, like for buttons, accordions, or other interactive elements.
—Mastering Animate Presence


Jan 26, 2026 by Raphael Salaja
When an element leaves the DOM, it's pretty much gone and as a result, there is no way to animate something that no longer exists.
Motion's Animate Presence fixes this. It keeps departing elements mounted long enough to animate out, then removes them. The basic usage is straightforward, wrap conditional content, define initial, animate, and exit states and the component handles the rest.

Raphael$57,206

CustomizeAn Example of A Component Powered by Animate Presence 1
The more interesting question is what happens when basic entry and exit animations are not enough. Components that need to know they are leaving. Animations that depend on navigation direction. Parent-child exits that coordinate. This is where the real power lives.
Reading Presence State
Sometimes a component needs to know it is exiting. Maybe it changes its appearance, disables interactions, or triggers side effects. The useIsPresent hook provides this information.2
Code Playground




1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useState } from "react";
import styles from "./styles.module.css";

const definitions = {
  present: {
    word: "present",
    pronunciation: "/ˈprez.ənt/",
    type: "adjective",
    definition:
      "In a particular place; being in view or at hand. Existing or occurring now, at this time.",
  },
  exiting: {
    word: "exit",
    pronunciation: "/ˈek.sɪt/",
    type: "verb",
    definition:
      "To go out of or leave a place; to depart from a scene, stage, or situation.",
  },
};

function Card() {
  const isPresent = useIsPresent();
  const entry = definitions[isPresent ? "present" : "exiting"];

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
    >
      <span className={styles.word}>{entry.word}</span>
      <span className={styles.pronunciation}>{entry.pronunciation}</span>
      <span className={styles.type}>{entry.type}</span>

The hook returns a boolean. True while mounted normally, false during the exit animation. You might use this to disable buttons while a component exits, switch visual states on unmount, or trigger cleanup when departure begins.
One constraint is that useIsPresent must be called from a component that is a child of Animate Presence. You cannot inline the hook in the parent where you conditionally render. This is why the demo above uses a separate Card component rather than putting the motion element directly inside the conditional.
Manual Exit Control
Standard exit animations run on a fixed timeline. But some scenarios require manual control. Async cleanup, external animation libraries, or coordinating with systems outside React.
The usePresence hook returns both the presence state and a safeToRemove callback. The component stays mounted until you call it.
Code Playground




1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
import { AnimatePresence, motion, usePresence } from "motion/react";
import { useEffect, useState } from "react";
import styles from "./styles.module.css";

function Notification() {
  const [isPresent, safeToRemove] = usePresence();

  useEffect(() => {
    if (!isPresent) {
      const timer = setTimeout(() => {
        safeToRemove();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isPresent, safeToRemove]);

  return (
    <motion.div
      className={styles.notification}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span className={styles.title}>
        {isPresent ? "Notification" : "Cleaning up..."}
      </span>
      <span className={styles.message}>
        {isPresent ? "Click dismiss to trigger cleanup" : "Saving state..."}
      </span>
    </motion.div>
  );
}

export default function App() {

The exit animation starts immediately. Your async work runs in parallel. When both the animation finishes and safeToRemove is called, the element unmounts. This is how you could save draft content before a modal closes, wait for a network request to complete, or hand control to GSAP or other animation libraries for more complex animations.3
Nested Exits
When a parent Animate Presence removes its children, nested exit animations do not fire by default. The parent wins. Sometimes you want both. A modal fading out while its content items also animate. The propagate prop enables this.
Code Playground




1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import styles from "./styles.module.css";

const items = ["A", "B", "C"];

export default function App() {
  const [show, setShow] = useState(true);

  const renderCard = (propagate: boolean) => (
    <AnimatePresence>
      {show && (
        <motion.div
          key="card"
          className={styles.card}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <span className={styles.label}>
            {propagate ? "With Propagate" : "No Propagate"}
          </span>
          <div className={styles.items}>
            <AnimatePresence propagate={propagate}>
              {items.map((item) => (
                <motion.div
                  key={item}
                  className={styles.item}
                  initial={{ opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(10px)" }}
                  transition={{ duration: 0.5 }}
                >
                  {item}
                </motion.div>

When true, removing the parent, triggers exit animations on both the parent and its nested children. Without it, children vanish instantly when the parent exits. Stuff like this goes unnoticed by many, but adding things like this really separetes people who care about the details from those who don't.
Modes
The mode prop controls timing between entering and exiting elements.
Code Playground




1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import styles from "./styles.module.css";

type Mode = "sync" | "wait" | "popLayout";

const modes: Mode[] = ["sync", "wait", "popLayout"];

function ModeExample({ mode, show }: { mode: Mode; show: boolean }) {
  return (
    <div className={styles.example}>
      <div className={styles.label}>{mode}</div>
      <div className={styles.icon}>
        <AnimatePresence mode={mode}>
          <motion.div
            key={show ? "a" : "b"}
            initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
          >
            {show ? "A" : "B"}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  const [show, setShow] = useState(true);

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {modes.map((mode) => (

sync
This is where entering and exiting elements animate simultaneously. It's useful for crossfades or when you want to animate both at the same time. You just have to bare in mind that both elements will be visible at the same time so you will have to handle the layouts to avoid conflicts.
wait
Here the exiting element waits for one to finish before the other starts. I use this when I want a more elegant transition between two elements. When I don't want to have both elements visible at the same time. One thing to pay note to is that because one element has to finish before the other can start, the duration of the animation will almost be doubled. So if you want something quicker you might have to mess around with the durations.
popLayout
Using this mode removes exiting elements from document immediately. They become absolutely positioned, allowing surrounding content to reflow. I use this alot when I need elements to be removed fast without layout shifts, so like list reordering, morphing layout animations etc. It's also handy when I need to run calculations on the parents bounds, like if I'm doing an animated width container and need the width of the parent to update quickly, inline with the animation.
Closing Thoughts
Even though CSS now has @starting-style for native exit animations.4 Simple transitions no longer need JavaScript. But the patterns in this article do. Reading presence state, manual exit control, directional animations, coordinated nested exits are things that Animate Presence offers that CSS can't at this point in time.
Animate Presence fills the gap between what CSS can handle and what real interfaces need. The component itself is simple, but hopefuly this article has helped you understand how to use it to it's fullest.
—
Sounds on The Web


Jan 4, 2026 by Raphael Salaja
We've collectively decided that the web should be mute.
I've never understood why. Native apps use sound constantly to confirm actions, signal errors, provide notifications and nobody thinks less of them for it. Same goes for games, or any other form of interactive media.
Yet on the web, sound is rare, often jarring, and frequently maligned as unprofessional or intrusive.
I think this is because people have probably had bad experiences with sound on the web. I've had my share of autoplaying music, loud error beeps, unnecessary clicks. These are valid complaints, but they miss the point: sound itself isn't the problem; it's how and when it's used.
Why Sound Matters
Your ears are faster than your eyes. The auditory cortex processes sound in about 25ms, while visual processing takes nearly ten times longer. When you need immediate feedback sound gets there first.
This has real consequences for how interfaces feel. A button that clicks feels faster than one that doesn't, even when the visual feedback is identical.

The difference is subtle but when you try it without, something feels off.
Sound bridges the gap between action and response in a way that visual feedback alone cannot. A notification that chimes is present in your room, not just on your display. It crosses the boundary between device and environment in a way that pixels never can.
The Emotional Layer
A single tone can communicate success, error, tension, or playfulness. To achieve the same thing visually, you'd need elaborate choreography colors shifting and much more. Researchers call this "auditory dominance in temporal processing."
In plain English, it's when sight and sound tell slightly different stories, we tend to believe our ears.
A form submission with a gentle chime feels different than one met with silence. An error with a soft thunk lands differently than a red border alone.
What Games Get Right
If you want to understand audio feedback done well, study games. They've been perfecting this for decades.
Video Game Sound Design - Stryxo
I'm not saynig you should turn your app into a game, but games have nailed the balance of informative, emotional, and non-intrusive sound. They use sound to reward actions, signal errors, and provide context without overwhelming the player.
When to Use Sound
Not every interaction needs audio. That was the mistake the early web made. The goal is to use sound where it adds value.
Some of the main examples include, confirmations for major actions like payments or uploads, errors and warnings that can't be overlooked, state changes that reinforce transitions, and notifications that interrupt without requiring visual attention. The sound should match the weight of the action and be informative rather than punishing.

Respecting Preferences
Some users don't want sound, and you should respect that. There's no prefers-reduced-audio media query yet, but prefers-reduced-motion works as a reasonable proxy since users who want less visual stimuli often want less audio stimuli too.
You should also provide an explicit toggle in settings, letting users opt out entirely or adjust volume independent of system volume.
The Counter-Arguments
There are legitimate reasons the web went silent, so let me address them directly.
"Users will hate it."
Only if you do it poorly. Aggressive, loud, or unnecessary sounds are annoying; subtle, appropriate, optional sounds are not. The autoplay video backlash was about intrusion, not about sound itself. Context matters.
"It's inaccessible."
Sound should complement, not replace. Every audio cue should have a visual equivalent. Users who can't hear, or choose not to, should lose nothing functional. Sound adds a layer; it's never a requirement.
"It's technically complicated."
Basic audio playback is straightforward. The Web Audio API offers more power when you need it, but simple Audio objects cover most cases. The implementation burden is genuinely low.
"It's not professional."
This is cultural inertia. Native apps use sound constantly and nobody considers it unprofessional. The web's silence is a historical accident, not a design principle.
Starting Small
You don't need to audio-design your entire application at once. Pick a single interaction that feels flat: a button that needs emphasis, a confirmation that gets overlooked, an action that would benefit from finality.
Add a sound, make it subtle, make it optional, and see how it changes the feeling of that moment. If it works, add another. Build the vocabulary gradually, learning what works for your product and your users.
The goal isn't to fill silence. It's to use sound where it earns its place, where it adds feedback, presence, or emotional resonance that visuals alone can't achieve. The web has been mute for too long. It doesn't have to stay that way.
—
To Spring or Not To Spring


Dec 29, 2025 by Raphael Salaja
Whenever I'm adding motion to something, one question comes up again and again. Should I use an easing curve, or a spring?
On the surface it feels like a stylistic choice, but in practice it is usually the difference between an interaction feeling obvious and one that feels subtly wrong.
Early in my time developing, I used to bounce between the two without much structure, trying an ease, then a spring, tweaking numbers until it stopped bothering me and moving on. That approach works sometimes, but it also produces a lot of motion that feels off in ways that are hard to explain.
What helped me was realizing that easing curves and springs are not interchangeable tools. They are not just two different ways to animate the same thing. They come from very different ways of thinking about motion, and they play different roles in an interface.
Once that clicked, the decision stopped being so hard.
Start with the interaction, not the animation
Before touching curves, parameters, or libraries, I try to step back and ask a single question: is this motion reacting to the user, or is it the system speaking?
That distinction ends up doing a surprising amount of work.
Eases vs Springs Decision Flowchart


If the motion needs to stay attached to the user, survive interruption, or preserve velocity, you are already leaning toward a spring. If the motion is the system announcing a change, guiding attention, or helping something land clearly, easing is usually the right model.
Framed this way, you are no longer choosing between animation techniques. You are choosing the role motion plays in the interaction.
The Roles Motion Tends to Play
There's a few kinds of motion that come up repeatedly in interfaces. Each has different needs, and each tends to align better with either easing curves or springs. As seen in the flowchart above, there's a few endpoints you can reach based on the role motion is playing. Let's break them down.
None
Not everything needs animation, and in some cases animation actively makes things worse. High-frequency interactions like typing, keyboard navigation, or fast toggles often feel slower and noisier when motion is added without a clear purpose. 1
Choosing no motion is still a design decision. It is a choice to prioritise immediacy and predictability over expressiveness, and very often it's the right call.
Springs
These work best when motion is directly tied to user input. Dragging, flicking, pressing, and gesture-driven interactions benefit from springs because they remain responsive even when interrupted and reflect the energy of the input itself.
They mimic real life, where objects have physics and momentum, which helps the interface feel more connected to the user's actions. Apple's Human Interface Guidelines 2 call this out explicitly. Because springs do not assume the interaction is finished, they can adapt fluidly to changes in input.


The example above is inspired by Apple’s WWDC 2023 session on springs. When you drag the ball and release it, the spring version snaps back in a way that reflects how you moved it. Fast drags feel snappier, slow drags feel heavier, and the motion feels connected to your action.
Switching the same interaction to an easing curve breaks that illusion, because the system waits for the input to end before politely running an animation.
If continuity and interruption matter, easing curves tend to fall apart. Springs hold up. The tradeoff is that springs can feel restless or overactive when the system is simply announcing a state change, which is why they are not a universal solution.
Linear
Linear motion often gets dismissed because it is misused. For spatial movement it almost always feels mechanical, since objects in the real world rarely move at a constant rate.
Where linear motion does make sense is when the animation represents time itself. Progress bars, loaders, scrubbing interactions, etc. benefit from it because it preserves a one-to-one relationship between time and progress.


Above is a simple held delete button using linear motion to represent progress. The fill moves at a constant rate, which makes it easy to understand how long the action will take.
If it eased in or out, the relationship between time and progress would break down, making it harder to understand.
Ease-In, Ease-Out, and Ease-In-Out
Ease-out starts quickly and slows down at the end, which is why it works so well for entrances and feedback. The interface feels responsive, but the softer landing gives the eye time to catch up. It is less about realism and more about communication, and while it breaks down if interruption or velocity matters, it remains a solid choice for system-driven responses.
Ease-in does the opposite, starting slowly and accelerating away. This usually feels wrong for entrances because the delay reads as lag, but it works well for exits where lingering pulls attention in the wrong direction. In those cases it acknowledges the action and then gets out of the way.
Ease-in-out spreads attention more evenly across the motion, making it a good fit for transitions between two equally important states like switching views or modes.

The animation above uses cubic-bezier(0.455, 0.03, 0.515, 0.955). It feels neutral and composed, which is useful, but easy to overuse, and when everything eases in and out interfaces can start to feel sluggish and overly polite.
Under The Hood
In order to choose between easing curves and springs, it helps to understand how they work under the hood. This section will aim to explain what's a spring and an easing function in the most basic way possible.
If you want something a bit more in depth, I recommend checking out Freya Holmér's video on The Beauty of Bézier Curves 3 for easing curves, and Apple's [Animate with springs]4 session for springs.
Easing Curves
Easing curves describe how motion progresses over a fixed duration. You decide how long the animation should take, and then decide how that time is distributed. In CSS and most design tools, this is expressed using cubic Bézier curves.
transition-timing-function: cubic-bezier(x1, y1, x2, y2);
MDN has a solid breakdown of the syntax if you want to dig into the specifics. 5 Rather than thinking about the math, it helps to think about intent. Those four numbers really describe two moments in time: how motion begins, and how it comes to rest.
x1, y1
The first control point affects responsiveness. Lower values ease into motion gradually, which can feel deliberate but can also introduce hesitation if overused.
Higher values ramp progress earlier, making motion start almost immediately, which is critical for things like presses and hovers where any delay is felt instantly.
x2, y2
The second control point shapes how motion ends. Higher values extend the landing and make motion feel calm and composed, while lower values shorten the deceleration and can make things feel sharp or tense.
If an animation feels uncomfortable at the end, this is almost always the place to look.
Duration
If an animation feels slow, it is almost never because the easing is wrong. It is because the duration is too long. Shortening timing nearly always improves perceived responsiveness before any curve adjustment does.
In practice, presses and hovers usually land between 120ms and 180ms, small state changes between 180ms and 260ms, and larger transitions can stretch up to around 300ms. 6 Beyond that point, motion starts to feel intentional rather than reactive, which is not inherently bad, but it does communicate something different.
Springs
Springs flip the model around. Instead of defining how long something should take, you describe how the system behaves and let it resolve naturally. In libraries like Motion 7, that often looks like this:
transition={{
  type: "spring",
  stiffness: 900,
  damping: 80,
  mass: 10,
}}
The names vary between libraries, but the concepts remain consistent. The reason springs feel different is simple: they do not assume the interaction is finished, which makes them resilient to interruption.
Stiffness, Damping, and Mass
Stiffness controls how strongly the system pulls toward the target, largely shaping how quickly motion begins.
Damping controls how quickly energy is removed, affecting whether motion settles cleanly or oscillates.
Mass defines how heavy the object feels, shaping how stiffness and damping are perceived rather than acting independently.
Tuning springs is often about finding the right balance between responsiveness and stability. High stiffness with low damping can feel snappy but unstable, while high damping with low stiffness can feel sluggish but secure.
The Key Difference
Easing curves have a predefined start and end in time, whereas springs do not.


Easing


Spring
That single distinction explains most of the behavior you see in practice, including why springs survive interruption so well while easing curves tend to fall apart as soon as the user changes their mind.
Conclusion
At a certain point, choosing between easing and springs stops being a technical decision and starts becoming a design one. Motion is just another way the interface communicates.
Once you are clear on what an interaction is trying to convey, the choice usually reveals itself without much hassle.
The goal is not to animate more, but to animate with intent, so that motion earns its place and fades into the experience instead of drawing attention to itself.
However there's always room to try things out. Don't be afraid to break the rules once in a while. At the end of the day, what matters most is that the interaction feels right. If you want to explore more foundational ideas, I wrote about the 12 Principles of Animation and how they apply to interfaces.

* 		Nielsen Norman Group's research on Animation for Attention and Comprehension covers when motion helps and when it just gets in the way.↩
* 		Apple's Human Interface Guidelines on Motion emphasizes physics-based animation for natural-feeling interactions.↩
* 		Freya Holmér's The Beauty of Bézier Curves is one of the clearest explanations of Bézier curves available.↩
* 		Apple's WWDC 2023 session Animate with springs is SwiftUI-focused but broadly applicable.↩
* 		MDN's cubic-bezier() documentation breaks down the math and syntax.↩
* 		These values align with Material Design's motion guidelines, which are a good starting point even outside Android.↩
* 		Motion is my go-to JavaScript animation library.


—
Pseudo Elements


Sep 15, 2025 by Raphael Salaja
This is a living document. It will be updated as new pseudo-elements that I find useful are released. For more detailed explanations on how things work, I highly recommend checking out the MDN Pseudo-elements Reference
Most developers know ::before and ::after. They're workhorses, used for decorative elements, clearfixes, and the occasional icon. But CSS has quietly shipped a new generation of pseudo-elements that do far more than add visual flair.
These newer pseudo-elements give you direct styling hooks into browser-native features. Dialogs, popovers, view transitions, scroll-driven navigation, form pickers. Things that once required JavaScript wrappers or couldn't be styled at all.
This guide covers the pseudo-elements worth knowing, when to reach for them, and how they change what's possible with CSS alone.
Before diving into the new, it helps to revisit what we already have. These pseudo-elements have been around for years, but they remain foundational.
::before & ::after
These create anonymous inline elements as the first or last child of their parent. They require content to render, even if it's empty.
The common use cases are decorative layers, icons, separators, and expanding hit targets without adding DOM nodes. They keep your HTML clean while enabling visual complexity.
One pattern I use constantly is using it for a simple button hover effect.

Here I am using ::before to add a subtle background hover scale effect to the button on hover.
I set the ::before to position: absolute and inset: 0 so it fills the button. Then I set the transform: scale(0.95) and opacity: 0 by default. On hover, I animate it to scale(1) and opacity: 1. This gives a nice tactile feel without extra markup.
View Transitions
The View Transitions API lets you animate between DOM states. Click a thumbnail, it morphs into a full-screen image. Navigate between pages, elements glide into their new positions. The API handles the snapshot diffing. You control the animation through pseudo-elements.
When you call document.startViewTransition(), the browser captures the current state, applies your DOM changes, then generates a tree of pseudo-elements representing both states. You style these to define how elements transition.

The example above shows a simple image lightbox. Clicking a thumbnail opens a dialog with a larger version of the image. The transition animates the image from its thumbnail position to the center of the screen.
Prior to view transitions, this effect required complex JavaScript libraries or manual cloning of elements. Now, with just a few lines of CSS, you get smooth, performant animations handled natively by the browser.
It works by using the view-transition-name property. When two elements share the same name across a transition, the browser treats them as the same element and interpolates between their positions, sizes, and styles.
In this example, we're cloning the thumbnail into a dialog. The original stays in place (hidden with visibility: hidden) so the layout doesn't shift. Before the transition starts, we assign view-transition-name: card to the source image.
Inside the transition callback, we remove that name and give it to the cloned image in the dialog. The browser sees one "card" disappear and another "card" appear, and morphs between them.
::view-transition-group(card) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
}
This pseudo-element targets the group containing both snapshots. We control timing here. The browser handles the position and size interpolation automatically.
Closing works the same way in reverse. We hand the name back to the source image before closing the dialog, and the browser animates the image back to its original position.
Wrapping Up
These modern pseudo-elements unlock powerful new capabilities in CSS.
From animating view transitions to styling native UI components, they reduce the need for JavaScript and keep your code cleaner.
As browser support grows, mastering these tools will be essential for building rich, interactive web experiences with CSS.
Sometimes you don't need to install a library. The browser has you covered.

—
12 Principles of Animation


Apr 8, 2025 by Raphael Salaja
Motion on the web has come a long way from simple transitions and hover effects. Motion is more than flair; it is communication, guiding users, reassuring them, and delighting them while transforming routine workflows into memorable experiences.
But not all animation is created equal. The difference between good and great often comes down to intention. Great animation is purposeful, subtle, and rooted in the principles that have guided designers for decades.
The Principles of Animation
The 12 Principles of Animation provide a framework for creating more engaging and lifelike animations. In the 1930s, Disney animators codified what they'd learned into twelve principles.1 They were trying to make drawings feel real. We're trying to make pixels feel human. The problems are surprisingly similar.
Squash and Stretch
Everything has it's own mass, and the way it moves and deforms is crucial to conveying its weight and personality. Drop a rubber ball. It flattens on impact, then springs back.
That momentary deformation tells your brain everything about its weight, material, and energy. Digital objects don't have physics so in turn we need to "fake" it.





Family's Wallet Icon Picker2
In this example, the wallet icon appears to squash and stretch on change. It's almost like it's morphing into a different shape. A simple but effective use of this principle.
It's small and most users won't consciously notice but they'll feel it, and that feeling adds to the overall experience.
There is a trap here though. Too much squash and stretch turns professional software into a cartoon. The goal is believability, not Looney Tunes (unless that's what you're going for).
As with all things in life, a balance must be struck.
Anticipation
Anticipation is the act of preparing users for what comes next. Before a baseball pitcher throws, they wind up. Before a dancer leaps, they bend their knees.
In practice, this means giving a clue before a major action occurs. Such cues tap into subconscious expectations.
Refresh
ing




Above is a pull-to-refresh interaction. As you drag down, the reveal hint appears from the top to indicate that releasing will trigger a refresh. The pulling down also feels elastic, giving a sense that something will happen on release.
Reserve anticipation for moments that matter. A notification badge might wiggle to hint at updates. A submit button might compress slightly before sending. But if every micro-interaction has a wind-up, your app will feel sluggish. Save the drama for the dramatic.
Staging
If anticipation is about the before, staging is about the during. When a complex panel opens, what should the user look at first? If everything animates simultaneously, the answer is "nothing" their attention scatters.

Raphael$57,206

Customize
Watch the sequence here. Clicking on the image brings the card into focus while dimming the background. The animation guides your eye to the important parts.
Think of staging as directing a film. You're not just showing information you're manipulating attention.
Straight Ahead Action & Pose to Pose
There are two ways to animate. Straight ahead means drawing frame after frame in sequence, letting the animation discover itself. Pose to pose means defining the key moments first, then filling in the gaps.
On the web, we mostly work pose to pose. We define the keyframes and let the browser interpolate the rest.
This matters more than it sounds. You don't need to obsess over every frame, you need just need to nail the important ones. Start state. End state. Maybe a midpoint for complex curves.

apple


apple


apple
Why is this important? Because focusing on key poses helps you prioritize what matters. It keeps your animations efficient and purposeful.
If something doesn't need to be animated, don't animate it (please). Not every key moment needs motion. Sometimes the best animation is none at all.
For example, consider context menus. Apple's context menus only animate on exit, never on entry. Opening happens instantly. They do this beecause context menus are used constantly, and that entrance animation would compound into irritation.
Follow Through & Overlapping Action
When you stop walking, your hair keeps moving. When you start running, your arms take a moment to catch up. Nothing in nature moves as a single rigid unit.
If you want your animations to feel more alive, you need to embrace this principle.




Dia's Split Tabs.3
The above example makes use of springs to make the transitions feel more alive. Springs itself is a whole topic that would need it's own essay to be discussed.
They add that organic overshoot-and-settle that easing curves can't replicate. Apple's WWDC23 talk on springs is worth your time if you want to go deeper.4
Knowning this, the maing danger is latency. Too much stagger and your interface feels slow, like it's thinking too hard, so save it for none critical elements.
Slow In & Slow Out
Nothing in nature starts or stops instantly. Even light takes time to fade.
This principle is the cornerstone of smooth, comfortable transitions. In practice, it’s all about easing curves, an element might ease-out as it leaves the screen or ease-in when it appears.
The result mimics how a car accelerates and brakes, or how a human moves, avoiding the jolt of an abrupt linear motion.


easeInSine


easeOutSine


easeInOutSine


easeInQuad


easeOutQuad


easeInOutQuad


easeInCubic


easeOutCubic


easeInOutCubic
Common Easing Functions.5
This is where easing curves earn their keep. An ease-out makes entrances feel snappy—the element arrives fast and settles gently. An ease-in works for exits, building momentum before departure. ease-in-out suits elements that need to feel deliberate, like a panel sliding across the screen.
easing.dev is an excellent playground for this.5 I'd reccomend spending some time there, experimenting with different curves to see how they affect the feel of motion.
Arcs
Arcs make movement feel organic. Instead of sliding elements in straight lines, a gentle curve adds realism and comfort. Use arcs for larger transitions or playful effects, but keep them subtle unless your app’s personality calls for more.
Apple's Dynamic Island.6
Apple's Dynamic Island uses this beautifully. Elements don't just resize, they flow along curved paths that feel inevitable, like water finding its level.
Arcs are hard to get right in UI. They're most useful for hero moments on landing pages or playful interactions where you want that extra polish. For utilitarian interfaces, straight lines are fine. But when you need magic, reach for a curve.
Secondary Action
These are little flourishes that support the main action, adding depth and feedback without stealing the spotlight.
Secondary actions might be something like a checkmark icon that pops and then does a brief sparkle after a form is successfully submitted. The sparkle isn’t the main message, but it reinforces the feeling of success in a fun way.


Family's Secure Wallet Button3
Add secondary actions to inject delight and clarity into moments of user feedback. Sound can also be a secondary action, like a subtle click or whoosh that reinforces the feeling of interaction.
Think of your favourite games or media, when they want to show impact they often use sound effects and visual effects to enhance the moment. Utilize this frame of thinking.
Timing
In animation, timing refers to the speed of an action, pretty self explanatory. Choosing the right duration is what makes interfaces feel snappy or sluggish, deliberate or chaotic.
A tooltip at 150ms feels responsive. The same tooltip at 400ms feels broken. The information hasn't changed, only the wait. And waiting, even for fractions of a second, erodes trust.

My rule: keep interactions under 300ms. Anything longer needs a good reason.
More importantly, be consistent. If your buttons animate at 200ms, all your buttons should animate at 200ms. Inconsistent timing creates a subconscious sense that something is wrong, even if users can't articulate why. Define your timing scale early. Reuse it everywhere.
Exaggeration
Reality is boring. Sometimes you need to push past it.
Exaggeration means amplifying motion beyond what's physically accurate to make a point land harder. It's theatrical. It's intentional. And in the right moments, it's exactly what you need.

Use exaggeration sparingly for moments when you want the user to feel something strongly or notice something important.
It’s particularly at home in onboarding sequences, empty states, confirmations, or error notifications. Here a touch of theatrics can increase engagement or clarity.
Solid Drawing
Traditional animators obsessed over making 2D drawings feel three-dimensional. They understood that believable volume creates believable characters.
We work in a different medium, but the principle translates. Shadows suggest depth. Layering implies hierarchy. Perspective hints at space beyond the viewport.



Linear Orbit7
CSS perspective is your friend here. It defines how far an object sits from the viewer, giving 3D transforms actual depth instead of flat rotation.
Another aspect is consistency in how things are drawn and move. If an icon rotates in 3D, it shouldn’t suddenly look flat or inverted incorrectly, paying attention to how things scale or skew maintains the illusion of volume.
Appeal
This is the one that ties everything together. Appeal is the difference between software you tolerate and software you love.
￼
John Phamous
￼
Gustav Ekerot
￼
Abhijeet Singh
￼
Mint
￼
Xavier (Jack)
￼
Henry Heffernan
A small scrollable sample of delightful creations on the web.8
Scroll through these examples. Notice how each one makes you feel something? That's appeal. It's not one technique, it's the sum of all the techniques, applied with care and taste.
Think about the products you keep coming back to. The ones you recommend to friends. They probably aren't the most feature rich. They're the ones that feel right. The ones where someone clearly gave a damn.
That's the goal. to make something people love.
Why This Still Matters
We live in an age of AI-generated interfaces and ship-fast culture. Polish feels like a luxury. Animation feels like scope creep. But here's the thing, when everything is fast, craft becomes the differentiator. When AI can generate any feature, the feeling of using software becomes the product.
In the end, great animation is invisible. Users don't think "nice ease-out curve." They think "this feels good." They don't know why. They just know they want to come back. And that's why these principles still matter. Because they help us create experiences that resonate on a human level,
They help make ui feel human.

* 		The Illusion of Life: Disney Animation is an amazing book that delves into the principles of animation, including squash and stretch, anticipation, and more. It’s a must-read for anyone serious about mastering animation.↩
* 		The Family Wallet Icon Picker is a great example of how squash and stretch can be used effectively in a user interface. The icon picker uses subtle animations to make the selection process feel more engaging and intuitive.↩
* 		Dia have a very nice example of follow-through in their splitting tabs animation. Check out the browser to see the live version.↩↩2
* 		The Animate with Springs talk from WWDC23 is a great resource for learning about how to use springs in animations. It's mainly about SwiftUI, but the concepts apply to any animation framework.↩
* 		Lochie's easing.dev is a great resource for exploring different easing functions and their applications. You can also build your own springs here too.↩↩2
* 		Rauno recorded this clip in his Invisible Details of Interaction Design essay. Worth the read.↩
* 		A recreation of the Linear loading animation, made by Emil can be found on their Twitter↩
* 		Some wonderful people building on the web, check out their profiles. John Phamous, Gustav Ekerot, Abhijeet Singh, Mint, Xavier (Jack), Florian, Lochie Axon, Pranathi Peri, Jakub Krehel and Henry Heffernan.

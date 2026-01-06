import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // See what's happening
    userDataDir: "./instagram_profile",
    defaultViewport : false
  });

  const page = await browser.newPage();
  
  if (page.url().includes("login")) {
  await page.goto('https://www.instagram.com/accounts/login/?hl=en');
  await new Promise(res => setTimeout(res, 2000))
   // Fill in the username and password
  await page.type('input[name="username"]', 'harszmcallister1@gmail.com');  // Replace #username with the actual selector
  await page.type('input[name="password"]', 'harsz1@123');  // Replace #password with the actual selector

  // Click the login button
  await page.click('div[class="html-div xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw x1xmf6yo x1e56ztr x11hdunq x11gldyt x1n2onr6 x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x1qjc9v5 x1oa3qoh x1nhvcw1"]');  // Replace #loginButton with the actual selector
  await new Promise(res => setTimeout(res, 2000));
  }

  

  const query = "cricket";
  await page.goto(`https://www.instagram.com/reels`);

  // --- Refined Step 1: Click the '... more' button using text search ---
const moreButtonText = 'more'; // Look for the exact text 'more' or '... more'

try {
    // 1. Wait until the container for the button is present (using a slightly broader, more stable class)
    // We expect the button or the caption text container to appear within 7 seconds.
    await page.waitForSelector('div.x1g9anri.x78zum5', { timeout: 7000 });

    // 2. Search for the span containing the text 'more' within the page's structure
    const clickableParentFound = await page.evaluate(async (text) => {
        // Find the <span> element that contains the specified text (case-insensitive)
        const moreSpan = Array.from(document.querySelectorAll('span'))
            .find(span => span.textContent.toLowerCase().includes(text.toLowerCase()));
        
        if (moreSpan) {
            // Find the closest clickable parent (often a <div> with role="button")
            const buttonParent = moreSpan.closest('div[role="button"]') || 
                                 moreSpan.closest('div[style*="cursor: pointer"]');

            if (buttonParent) {
                buttonParent.click();
                return true; // Click successful
            }
        }
        return false; // Button not found or already expanded
    }, moreButtonText);
    
    // 3. Conditional Waiting: If a click was executed, wait for the content expansion
    if (clickableParentFound) {
        // CRITICAL: Wait for a hashtag link to appear, confirming expansion
        await page.waitForSelector('div.x1g9anri.x78zum5 a[href*="/explore/tags/"]', { timeout: 5000 });
        console.log("Caption expanded and hashtags are now visible.");
    } else {
        console.log("Caption already fully visible or 'more' button not found.");
    }

} catch (error) {
    // If any part of the try block fails (including the final waitForSelector), this catch fires.
    console.log("No '... more' button found or timed out waiting for expansion. Error details:", error.message);
    // If the error is only a timeout on the waitForSelector, it means the content was already visible.
}
    
   const results = await page.evaluate(() => {
    
    // --- STEP 1: Find the most stable anchor - the caption text SPAN ---
    // The caption text itself is inside a SPAN with dir="auto". 
    // We look for this specific SPAN that contains the caption.
    const captionSpan = Array.from(document.querySelectorAll('span[dir="auto"]')).find(span => {
        // We assume the caption is the span that directly contains the main text and is inside a specific section of the page.
        // We can't rely on classes, so we rely on DOM structure/context.
        // A common pattern is the SPAN is a direct child of a DIV that starts the caption structure.
        return span.closest('div[role="dialog"], article') || 
               (span.parentElement && span.parentElement.className.includes('html-div'));
    });

    let hashtags = [];
    
    if (captionSpan) {
        // --- STEP 2: Find the top-level container for the caption ---
        // Traverse up to find a larger, more inclusive parent that holds *only* the current post's caption area.
        // We'll go up three levels from the text span to capture the entire description block.
        let descriptionContainer = captionSpan.parentElement; 
        for (let i = 0; i < 3; i++) {
            if (descriptionContainer) {
                descriptionContainer = descriptionContainer.parentElement;
            } else {
                break;
            }
        }

        // Use the found container (or fallback to the body if finding the container failed)
        const searchScope = descriptionContainer || document.body;
        
        // --- STEP 3: Scoped Query ---
        // Query for ALL hashtag links (<a> tags where href contains '/explore/tags/') 
        // that are descendants of the specific searchScope.
        const hashtagElements = searchScope.querySelectorAll('a[href*="/explore/tags/"]');
        
        // Process the results
        hashtags = Array.from(hashtagElements)
            .map(a => a.innerText)
            .map(text => text.replace(/^#/, '').trim())
            .filter(text => text.length > 0);
    }
    
    return {
        url: window.location.href,
        hashtags: [...new Set(hashtags)] 
    };
});

console.log("reel data : " +  JSON.stringify(results));

//await page.locator('span[aria-hidden="true"]', { hasText: 'more' }).click();


//await new Promise(res => setTimeout(res, 1000))

// await page.keyboard.press('ArrowDown');
// await new Promise(res => setTimeout(res, 1000))

// for (let i = 0; i < 10; i++) {

//   // Wait for reel to load
//   await new Promise(res => setTimeout(res, 1000));

//   const moreBtns = await page.$$('span[aria-hidden="true"]');
//   // Find the one with the correct text
//   for (const btn of moreBtns) {
//       const text = await page.evaluate(el => el.textContent.trim(), btn);
//       if (text.includes('more')) {
//           await btn.click();
//           break;
//       }
//   }

//   // Go to next reel
//   await page.keyboard.press('ArrowDown');
//   await new Promise(res => setTimeout(res, 2000))
// }

// const allElement = await page.$("div[class='x1ej3kyw x1ey2m1c x78zum5 xdt5ytf xtijo5x x1o0tod x1qughib x10l6tqk x13vifvy']");
// console.log(allElement);
//     //await page.waitForSelector('div[role="button"] span:has-text("… more")', { timeout: 5000 });
//     await allElement.evaluate(() => {
//       console.log("inside evaluate")
//       const span = Array.from(document.querySelectorAll('div[class="x1g9anri x78zum5 xvs91rp xmix8c7 xd4r4e8 x6ikm8r x10wlt62 x1i0vuye"] span'))
//         .find(el => el.textContent.trim().toLowerCase() === '… more');
//       if (span) span.click();
//     });
//     await new Promise(res => setTimeout(res, 1000));

// await page.keyboard.press('ArrowDown'); // simulate swipe to next reel
//     await new Promise(res => setTimeout(res, 2000)); // wait 2 sec for next reel to load

// try{
//   while(true){



//       const allElement = await page.$("div[class='x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw xyamay9 xv54qhq x1l90r2v xf7dkkf x1uhb9sk x1plvlek xryxfnj x1iyjqo2 x2lwn1j xeuugli x1q0g3np xqjyukv xuk3077 x1oa3qoh x1nhvcw1']");
//       //await page.waitForSelector('div[role="button"] span:has-text("… more")', { timeout: 5000 });
//       await allElement.evaluate(async () => {
//         const span = Array.from(document.querySelectorAll('div[role="button"] span'))
//           .find(el => el.textContent.trim().toLowerCase() === '… more');
//         if (span){
//           span.click();
//           await new Promise(res => setTimeout(res, 2000));
//         } 
//       });

//       const tagsElement = await allElement.$$eval('a[class="x1i10hfl xjbqb8w x1ejq31n x18oe1m7 x1sy0etr xstzfhl x972fbf x10w94by x1qhh985 x14e42zd x9f619 x1ypdohk xt0psk2 xe8uvvx xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x16tdsg8 x1hl2dhg xggy1nq x1a2a7pz x1g9anri xvs91rp x1s688f x1vlc3oy  _aa9_ _a6hd"]', el => el.textContent);
//       if(tagsElement != undefined && tagsElement.length > 0){
//         for(let t of tagsElement){
//           console.log(t);
//           // const tag = await t.$eval("a", el => el.textContent);
//           // if(tag != undefined && tag.toString().toLowerCase() == "#cricket"){
//           //   console.log(await allElement.$("span[class='x1lliihq x1plvlek xryxfnj x1n2onr6 x1ji0vk5 x18bv5gf x193iq5w xeuugli x1fj9vlw x13faqbe x1vvkbs x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1i0vuye xvs91rp xo1l8bm x9bdzbf x10wh9bi xpm28yp x8viiok x1o7cslx']", el => el.textContent));
//           // }
//         }
//       }

//       await page.keyboard.press('ArrowDown'); // simulate swipe to next reel
//       await new Promise(res => setTimeout(res, 2000)); // wait 2 sec for next reel to load
//     }
//   }
// catch
// {
//  console.log("exception occured");
// }

  // // Scroll to load reels
  // for (let i = 0; i < 5; i++) {
  //   await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  //   await new Promise(res => setTimeout(res, 2000))
  // }

  // // Get reel post links (Reels are videos)
  // const postLinks = await page.$$eval('a', links =>
  //   links.map(link => link.href).filter(href => href.includes('/reel/'))
  // );

  // console.log("Found Reels:", postLinks.length);

  // const reelData = [];

  // for (const link of postLinks) {
  //   await page.goto(link, { waitUntil: 'networkidle2' });

  //   await page.waitForTimeout(3000);

  //   const views = await page.evaluate(() => {
  //     const viewElement = document.querySelector('span.x1lliihq'); // This might change based on DOM updates
  //     return viewElement ? viewElement.innerText : null;
  //   });

  //   reelData.push({ link, views });
  // }

  // console.log("Reel Data:", reelData);

  //await browser.close();
})();
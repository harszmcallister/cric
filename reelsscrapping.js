import puppeteer from 'puppeteer';
import Redis from 'ioredis';
import JSONCache from 'redis-json';

// Configuration
const LIKE_COUNT_THRESHOLD = 100; // Minimum likes required to save to Redis
const QUERY_TERMS = ["cricket"]; // Array of query terms to match in captions

const redis = new Redis();
const jsonCache = new JSONCache(redis);

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

  
  await page.goto(`https://www.instagram.com/reels`);
  await new Promise(res => setTimeout(res, 1000));
  let count = 0
  let reelData = [];
  while (count < 10) 
  {
    const reelUrl = page.url();

    await page.waitForSelector('span');

    await expandCurrentReelMore(page);

    await new Promise(res => setTimeout(res, 3000));

    const caption = await getCurrentReelCaption(page);

    //const hashtags = await getCurrentReelHashtags(page);

    const likes = parseAbbreviatedNumber(await getCurrentReelLikeCount(page));

    //const comments = parseAbbreviatedNumber(await getCurrentReelCommentCount(page));

    // Check if likes count exceeds threshold and caption contains any query term
    const captionText = Array.isArray(caption) ? caption.join(' ').toLowerCase() : String(caption).toLowerCase();
    const hasQueryTerm = QUERY_TERMS.some(term => captionText.includes(term.toLowerCase()));
    
    if (likes > LIKE_COUNT_THRESHOLD && hasQueryTerm) {
      const reelInfo = {
        caption: caption,
        likes: likes
      };
      await jsonCache.set(reelUrl, reelInfo);
      console.log("✓ Saved to Redis - url: " + reelUrl + " | caption: " + caption + " | likes: " + likes);
    } else {
      let reason = [];
      if (likes <= LIKE_COUNT_THRESHOLD) reason.push("likes too low (" + likes + ")");
      if (!hasQueryTerm) reason.push("missing query terms [" + QUERY_TERMS.join(", ") + "]");
      console.log("✗ Not saved - url: " + reelUrl + " | reason: " + reason.join(" & "));
    }
    
    await page.keyboard.press('ArrowDown');
    await new Promise(res => setTimeout(res, 2000));
    count++;
  }

  // Close Redis cache connection
  await redis.disconnect();
  await browser.close();
})();

async function expandCurrentReelMore(page) {
    await page.evaluate(() => {
        // Find the element at the center of the viewport
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (!el) return;

        // Find the reel root container
        const reelRoot = el.closest('div[role="dialog"], section, div');
        if (!reelRoot) return;

        // Find a visible "... more" span inside this reel
        const moreBtn = [...reelRoot.querySelectorAll('span')]
            .find(span => span.textContent.trim() === '… more' && span.offsetParent !== null);

        // Click it if found
        if (moreBtn) moreBtn.click();
    });
}

async function getCurrentReelCaption(page) {
    return await page.evaluate(() => {
        // Find the element at the center of the viewport
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (!el) return "";

        // Find the reel root container
        const reelRoot = el.closest('div[role="dialog"], section, div');
        if (!reelRoot) return "";

        // Find the caption text inside the reel
        const spans = [...reelRoot.querySelectorAll("span")];

        // console.log(spans
        //     .map(s => s.textContent.trim())
        //     .filter(t => t.length > 0));

        return spans
            .map(s => s.textContent.trim());
    });
}

async function getCurrentReelHashtags(page) {
    return await page.evaluate(() => {
        // find the currently visible reel
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (!el) return [];

        // reel root container
        const reelRoot = el.closest('div[role="dialog"], section, div');

        if (!reelRoot) return [];

        // now find hashtags ONLY inside this reel
        return [...reelRoot.querySelectorAll('a[href^="/explore/tags/"]')]
            .map(a => a.textContent.trim())
            .filter(tag => tag.startsWith("#"));
    });
}

// async function getCurrentReelLikeCount(page) {
    
//     // --- 0. Get the stable root element handle ---
//     const reelRootHandle = await page.evaluateHandle(() => {
//         // Find the element at the center of the screen
//         const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
//         if (!el) return null;

//         // Find the root container for the current Reel (stable tags)
//         return el.closest('div[role="dialog"], article, main, section');
//     });

//     if (!reelRootHandle || await reelRootHandle.getProperty('nodeType') === null) {
//         return '0';
//     }
    
//     // --- 1. Execute the core traversal logic within the browser context ---
//     const likeCount = await page.evaluate((rootElement) => {
        
//         // Find the Stable Anchor: The 'Like' icon SVG
//         const likeIcon = rootElement.querySelector('svg[aria-label="Like"]');
//         if (!likeIcon) return '0';

//         // Traverse up to the clickable button container (role="button")
//         const likeButton = likeIcon.closest('div[role="button"]');
//         if (!likeButton) return '0';
        
//         // --- 2. THE CORRECTED NAVIGATION PATH ---
//         // Go up two levels (to the <span> wrapper) to find the correct sibling.
//         const wrapperSpan = likeButton.parentElement.parentElement; 
        
//         // The count container is the sibling of the wrapper <span>
//         const countContainer = wrapperSpan.nextElementSibling;
        
//         if (countContainer) {
//             // --- 3. Drill down to the innermost span text ---
//             // Finds: span[dir="auto"] > span (the text container)
//             const countSpan = countContainer.querySelector('span[dir="auto"] > span');                 
//             if (countSpan) {
//                 return countSpan.textContent.trim();
//             }
//         }
        
//         return '0';

//     }, reelRootHandle);

//     // Clean up the handle
//     await reelRootHandle.dispose();
//     return likeCount;
// }

async function getCurrentReelLikeCount(page) {

    // --- 1. Execute logic to find the VISIBLE like button directly ---
    const likeCount = await page.evaluate(() => {
        
        // A. Get all Like icons currently in the DOM
        const allLikeIcons = document.querySelectorAll('svg[aria-label="Like"]');
        
        if (allLikeIcons.length === 0) return '0';

        // B. Find the one that is actually visible on screen
        let targetIcon = null;
        let minDistanceToCenter = Infinity;
        const viewportCenterY = window.innerHeight / 2;

        for (const icon of allLikeIcons) {
            const rect = icon.getBoundingClientRect();
            
            // Check if the icon is roughly within the viewport
            // (We add some buffer just in case it's slightly off-center)
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                
                // Calculate how close this icon is to the vertical center of the screen
                // The correct icon is usually the one closest to the middle
                const distance = Math.abs(rect.top - viewportCenterY);
                
                if (distance < minDistanceToCenter) {
                    minDistanceToCenter = distance;
                    targetIcon = icon;
                }
            }
        }

        if (!targetIcon) {
            // Fallback: If no icon is perfectly centered, take the one that occupies the most screen space
            // or just return 0.
            return '0';
        }

        // --- C. Now run the Traversal Logic on the specific targetIcon ---
        
        // Traverse up to the clickable button container (role="button")
        const likeButton = targetIcon.closest('div[role="button"]');
        if (!likeButton) return '0';
        
        // Go up two levels (to the <span> wrapper) to find the correct sibling
        const wrapperSpan = likeButton.parentElement.parentElement; 
        
        // The count container is the sibling of the wrapper <span>
        const countContainer = wrapperSpan ? wrapperSpan.nextElementSibling : null;
        
        if (countContainer) {
            // Drill down to the innermost span text
            const countSpan = countContainer.querySelector('span[dir="auto"] > span');                
            if (countSpan) {
                return countSpan.textContent.trim();
            }
        }
        
        return '0';

    });

    return likeCount;
}



async function getCurrentReelCommentCount(page) {
    
    // --- 0. Get the stable root element handle ---
    const reelRootHandle = await page.evaluateHandle(() => {
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (!el) return null;
        return el.closest('div[role="dialog"], article, main, section');
    });

    if (!reelRootHandle || await reelRootHandle.getProperty('nodeType') === null) {
        return '0';
    }
    
    // --- 1. Execute the core traversal logic within the browser context ---
    const commentCount = await page.evaluate((rootElement) => {
        
        // Find the Stable Anchor: The 'Comment' icon SVG
        const commentIcon = rootElement.querySelector('svg[aria-label="Comment"]');
        if (!commentIcon) return '0';

        // --- Navigation Path: Find the common ancestor and search for the span within it ---
        // For the Comment structure, the icon and count are close siblings inside 
        // a common ancestor (often the great-grandparent of the SVG).
        const commonContainer = commentIcon.closest('div[role="button"]') || commentIcon.parentElement.parentElement;
        
        if (commonContainer) {
            // Drill down to the innermost span with the dir="auto" attribute
            const countSpan = commonContainer.querySelector('span[dir="auto"] > span');
            
            // Fallback for cases where the structure is slightly different 
            // (just search for any span with text that looks like a number inside the container)
            if (!countSpan) {
                 const allSpans = [...commonContainer.querySelectorAll('span')];
                 const textSpan = allSpans.find(s => s.textContent && /^\s*[\d,.]+[KMB]?\s*$/i.test(s.textContent));
                 return textSpan ? textSpan.textContent.trim() : '0';
            }

            return countSpan.textContent.trim();
        }
        
        return '0';

    }, reelRootHandle);

    await reelRootHandle.dispose();
    return commentCount;
}

/**
 * Converts a string representation of a large number (e.g., "195.2M", "12K", "8,211") 
 * into its actual numerical value.
 *
 * @param {string | null | undefined} numStr The string containing the number.
 * @returns {number} The actual number, or 0 if the input is invalid.
 */
function parseAbbreviatedNumber(numStr) {
    if (!numStr) {
        return 0;
    }
    
    // 1. Clean up and convert to lowercase for uniform processing
    const cleanStr = String(numStr).trim().toLowerCase();

    // Mapping for multipliers (K, M, B)
    const multipliers = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000
    };

    // Regex to capture the number part and the optional unit (K, M, or B)
    // Matches formats like "195.2M" or "12k"
    const match = cleanStr.match(/^([\d.,]+)([kmb])$/i);

    if (match) {
        // Case 1: Abbreviated Format (e.g., 195.2M)
        
        // Remove commas from the number part, as they can sometimes appear before the unit 
        const valueStr = match[1].replace(/,/g, ''); 
        const unit = match[2];

        const value = parseFloat(valueStr);
        const multiplier = multipliers[unit];
        
        if (isNaN(value) || !multiplier) {
            return 0;
        }

        return Math.round(value * multiplier);
    } 
    
    // Case 2: Standard Number Format (e.g., 8,211 or 45)
    
    // Remove all commas for standard number parsing
    const standardNumStr = cleanStr.replace(/,/g, '');
    const standardNum = parseFloat(standardNumStr);

    return isNaN(standardNum) ? 0 : standardNum;
}
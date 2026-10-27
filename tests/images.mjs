export async function decodePageImages(page){
  // A lazy image outside the viewport is not a broken image. In this isolated
  // test, fetch and decode every present image before checking layout/assets.
  await page.locator('img').evaluateAll(async imgs=>{
    await Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();}));
  });
}

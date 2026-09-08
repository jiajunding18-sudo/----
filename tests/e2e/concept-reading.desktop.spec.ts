import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import katex from "katex";

function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function renderTechnicalFixture(page: Page) {
  await page.goto("/knowledge/python-core/");
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href),
  );
  const inlineMath = katex.renderToString("I(x, y) = R(x, y) + G(x, y)", {
    throwOnError: true,
  });
  const displayMath = katex.renderToString(
    String.raw`\mathbf{p}' = \mathbf{K}[\mathbf{R}\mid\mathbf{t}]\mathbf{P}`,
    { displayMode: true, throwOnError: true },
  );
  await page.setContent(
    `<!doctype html><html lang="zh-CN"><head><title>技术元素测试 fixture</title>${stylesheets
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join("")}</head><body><main><div class="learning-document">
        <h1>技术元素测试 fixture</h1>
        <p>行内公式 ${inlineMath} 应与中文基线协调。</p>
        ${displayMath}
        <div class="table-scroll-container" role="group" aria-label="可横向滚动的数据表" tabindex="0">
          <table><thead><tr><th>输入条件</th><th>预期结果</th><th>验证方式</th><th>误差说明</th></tr></thead>
          <tbody><tr><td>标准曝光</td><td>灰度稳定</td><td>重复测量三次</td><td>报告均值与极差</td></tr></tbody></table>
        </div>
        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='300'/%3E" alt="普通 Markdown 图片" width="1200" height="300">
        <figure><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'/%3E" alt="相机坐标投影示意图" width="640" height="360"><figcaption>图 1：测试 fixture 的图注。</figcaption></figure>
      </div></main></body></html>`,
  );
}

test("Concept 技术正文提供高亮代码、复制反馈与学习环节层级", async ({
  context,
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:4173",
  });
  await page.goto("/knowledge/python-core/");

  const document = page.locator(".learning-document");
  await expect(document.locator(":not(pre) > code").first()).toBeVisible();
  const pythonBlock = document.locator('[data-code-language="python"]');
  await expect(pythonBlock).toBeVisible();
  await expect(pythonBlock.locator(".code-language-label")).toHaveText("Python");
  await expect(pythonBlock.locator(".hljs-keyword").first()).toBeVisible();

  const copyButton = pythonBlock.getByRole("button", { name: "复制代码" });
  await copyButton.focus();
  await expect(copyButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(pythonBlock.getByRole("button", { name: "已复制" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("def summarize(items, dark_threshold):");

  await expect(
    document.locator('[data-learning-section="example"]'),
  ).toContainText("Worked Example");
  await expect(
    document.locator('[data-learning-section="recall"]'),
  ).toContainText("Active Recall");
  await expect(
    document.locator('[data-learning-section="practice"]'),
  ).toContainText("Practice");
  await expect(
    document.locator('[data-learning-section="evidence"]'),
  ).toContainText("Mastery Evidence");

  const resourceLink = page.getByRole("link", { name: /The Python Tutorial/ });
  await expect(resourceLink).toHaveAttribute(
    "href",
    "/resources/python-tutorial/",
  );
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 1A 数学正文渲染公式、正式资源与 planned Project 映射", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/vectors-and-matrices/");

  const document = page.locator(".learning-document");
  await expect(document.locator(".katex-display").first()).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /为什么现在学/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", {
      level: 3,
      name: /在机器视觉中会在哪里使用/u,
    }),
  ).toBeVisible();
  await expect(
    document.getByText("当前不要求证明所有矩阵定理", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "18.06SC Linear Algebra" }),
  ).toHaveAttribute("href", "/resources/mit-ocw-linear-algebra/");

  const projectUsage = page.locator(
    '[data-concept-project-id="project.math-vision-lab"]',
  );
  await expect(projectUsage).toContainText("hard · 需要已理解");
  await expect(projectUsage).toContainText("planned · 项目正文尚未发布");
  await expectNoHorizontalOverflow(page);
  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 1B 正文渲染公式、代码、表格、TOC、深链接与正式映射", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/least-squares-and-residuals/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /最小二乘、残差与超定方程/u,
    }),
  ).toBeVisible();
  await expect(document.locator(".katex-display").first()).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toBeVisible();
  await expect(document.getByRole("table")).toBeVisible();

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await expect(workedExampleLink).toHaveAttribute(
    "href",
    "#section-8-worked-example-四次带噪测量拟合直线",
  );
  await workedExampleLink.click();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example-四次带噪测量拟合直线");
  await page.reload();
  await expect(
    page.locator("#section-8-worked-example-四次带噪测量拟合直线"),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Linear algebra — NumPy Manual" }),
  ).toHaveAttribute("href", "/resources/numpy-linear-algebra/");
  const projectUsage = page.locator(
    '[data-concept-project-id="project.math-vision-lab"]',
  );
  await expect(projectUsage).toContainText("hard · 需要已理解");
  await expect(projectUsage).toContainText("planned · 项目正文尚未发布");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Phase 9C 数值稳定性正文渲染诊断实验、TOC 与 draft Project 映射", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/numerical-stability-and-conditioning/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /数值稳定性、条件数与误差传播/u,
    }),
  ).toBeVisible();
  await expect(document.locator(".katex-display").first()).toBeVisible();
  const pythonBlocks = document.locator('[data-code-language="python"]');
  await expect(pythonBlocks).toHaveCount(2);
  await expect(pythonBlocks.first()).toBeVisible();
  await expect(pythonBlocks.nth(1)).toBeVisible();
  await expect(document.getByRole("table").first()).toBeVisible();
  await expect(document).toContainText("小 residual，明显参数变化");
  await expect(document).toContainText("这不是 numpy.linalg.lstsq 的程序错误");
  await expect(document).toContainText("condition indicator 约为 6708.20");
  await expect(document).toContainText("两种表示描述的是同一个物理问题");

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  const workedExampleHref = await workedExampleLink.getAttribute("href");
  expect(workedExampleHref).toMatch(/^#section-8-worked-example-/u);
  await workedExampleLink.click();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe(decodeURIComponent(workedExampleHref ?? ""));
  await page.reload();
  await expect(page.locator(workedExampleHref ?? "#missing-worked-example")).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Linear algebra — NumPy Manual" }),
  ).toHaveAttribute("href", "/resources/numpy-linear-algebra/");
  const projectUsage = page.locator(
    '[data-concept-project-id="project.math-vision-lab"]',
  );
  await expect(projectUsage).toContainText("hard · 需要已理解");
  await expect(projectUsage).toContainText("planned · 项目正文尚未发布");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 2 图像计算正文渲染代码、表格、TOC、深链接与正式资源", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/numpy-arrays/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /NumPy 数组、轴、切片与广播/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(6);
  await expect(document.getByRole("table")).toBeVisible();
  await expect(document).toContainText("shape 本身不能替你猜语义");

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  const workedExampleHref = await workedExampleLink.getAttribute("href");
  expect(workedExampleHref).toMatch(/^#section-8-worked-example-/u);
  await workedExampleLink.click();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe(decodeURIComponent(workedExampleHref ?? ""));
  await page.reload();
  await expect(page.locator(workedExampleHref ?? "#missing-worked-example")).toBeVisible();

  await expect(
    page.getByRole("link", { name: "NumPy: the absolute basics for beginners" }),
  ).toHaveAttribute("href", "/resources/numpy-absolute-beginners/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Stage 2 R1 正文呈现安全表示往返与标量/RGB 显示分流", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/knowledge/digital-image-representation/");
  const representationDocument = page.locator(".learning-document");
  await expect(representationDocument).toContainText("uint8 round-trip max error");
  await expect(representationDocument).toContainText("float quantization max error");
  await expect(representationDocument).toContainText("rgb[:, :, 0] = red");
  await expect(representationDocument).toContainText(
    "gray_restored.astype(np.int16) - gray.astype(np.int16)",
  );
  await expectNoHorizontalOverflow(page);

  await page.goto("/knowledge/image-plots/");
  const plotsDocument = page.locator(".learning-document");
  await expect(plotsDocument).toContainText("H×W×3");
  await expect(plotsDocument).toContainText("不能把单一 scalar colormap");
  await expect(plotsDocument).toContainText("rgb_axis.imshow(rgb)");
  await expect(plotsDocument).toContainText("不保留像素的空间位置");
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("OpenCV I/O 正文呈现失败检查、通道契约、无损往返与正式资源", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-io-color/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /图像读写与色彩空间/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(8);
  await expect(document.getByRole("table")).toBeVisible();
  await expect(document).toContainText("if image is None:");
  await expect(document).toContainText("cv2.COLOR_BGR2RGB");
  await expect(document).toContainText("assert bgr[0, 0].tolist() == [0, 0, 255]");
  await expect(document).toContainText("np.array_equal(reloaded, bgr)");
  await expect(document).toContainText("actual_min = image.min().item()");
  await expect(document).toContainText("不透明度、透明程度或覆盖程度");
  await expect(document).toContainText('inspect_image("reloaded BGR", reloaded)');
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 1/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 2/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 3/u }),
  ).toBeVisible();
  await expect(document).toContainText("普通照片不要求提供预先已知的像素真值");

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  const workedExampleHref = await workedExampleLink.getAttribute("href");
  expect(workedExampleHref).toBe("#section-8-worked-example");
  await workedExampleLink.click();
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe(decodeURIComponent(workedExampleHref ?? ""));

  await expect(
    page.getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("ROI/Mask 正文呈现坐标、共享内存、两类输出契约与失败诊断", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-roi-masks/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /感兴趣区域与掩膜/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(16);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("image[y1:y2, x1:x2]");
  await expect(document).toContainText("np.shares_memory(working, roi_view)");
  await expect(document).toContainText("selected_color.shape == (true_count, 3)");
  await expect(document).toContainText("selected_gray.shape == (true_count,)");
  await expect(document).toContainText("selected.shape == (N, C)");
  await expect(document).toContainText(
    "不会因为变量名叫 source 就自动变成只读",
  );
  await expect(document).toContainText(
    "input → expected → actual → reason → correction",
  );
  await expect(document).toContainText("silent clipping");
  await expect(document).toContainText("mask shape mismatch");
  await expect(document).toContainText("assert np.array_equal(source, original)");
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 1/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 2/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 3/u }),
  ).toBeVisible();
  await expect(
    document.getByRole("heading", { level: 3, name: /Checkpoint 4/u }),
  ).toBeVisible();

  const toc = page.locator('[data-concept-toc="desktop"]');
  const masteryLink = toc.getByRole("link", { name: /12\. Mastery Evidence/u });
  const masteryHref = await masteryLink.getAttribute("href");
  expect(masteryHref).toBe("#section-12-mastery-evidence");
  await masteryLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe(decodeURIComponent(masteryHref ?? ""));

  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", {
        name: "NumPy: the absolute basics for beginners",
        exact: true,
      }),
  ).toHaveAttribute("href", "/resources/numpy-absolute-beginners/");
  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("几何变换正文呈现 H/W、防错、已知点、插值与 clipping 闭环", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-geometric-transforms/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /缩放、旋转与仿射变换/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(11);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("不是把像素颜色直接乘了一下");
  await expect(document).toContainText("(new_width, new_height)");
  await expect(document).toContainText("INTER_NEAREST");
  await expect(document).toContainText("INTER_LINEAR");
  await expect(document).toContainText("INTER_AREA");
  await expect(document).toContainText("rotation_matrix.shape == (2, 3)");
  await expect(document).toContainText("translated_point, [7.0, 3.0]");
  await expect(document).toContainText("src_points.shape == dst_points.shape == (3, 2)");
  await expect(document).toContainText("same_canvas");
  await expect(document).toContainText("larger_canvas");
  await expect(document).toContainText("negative_larger");
  await expect(document).toContainText("rotation scale");
  await expect(document).toContainText("不能共线");
  await expect(document).toContainText(
    "input → expected → actual → reason → correction",
  );
  await expect(document).toContainText("Perspective Transformation");
  for (const checkpoint of [1, 2, 3, 4]) {
    await expect(
      document.getByRole("heading", {
        level: 3,
        name: new RegExp(`Checkpoint ${checkpoint}`, "u"),
      }),
    ).toBeVisible();
  }

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");

  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("基础滤波正文呈现 kernel、数值安全、边界与定量诊断闭环", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-filtering-basics/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /平滑、锐化与基础滤波/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(11);
  await expect(document.getByRole("table")).toBeVisible();
  await expect(document).toContainText("hand_center == 5.0");
  await expect(document).toContainText("总共有 9 个位置");
  await expect(document).toContainText("image[2:7, 2:5]");
  await expect(document).toContainText("standard deviation，标准差");
  await expect(document).toContainText("smoothing_axes");
  await expect(document).toContainText("5 * 40 - 36 - 48 - 35 - 183 == -102");
  await expect(document).toContainText("sharp_float[4, 6] == -102.0");
  await expect(document).toContainText("vmin=-128, vmax=560");
  await expect(document).toContainText(
    "inspect raw float → clip if output contract requires → rint → astype(uint8)",
  );
  await expect(document).toContainText("correlation（相关）");
  await expect(document).toContainText("BORDER_CONSTANT");
  await expect(document).toContainText("BORDER_REPLICATE");
  await expect(document).toContainText("flat_region_variation");
  await expect(document).toContainText("edge_contrast");
  await expect(document).toContainText("小图像中的大 kernel 与 border 耦合");
  await expect(document).toContainText(
    "Practice calculations / diagnostics → Evidence summary",
  );
  for (const checkpoint of [1, 2, 3, 4]) {
    await expect(
      document.getByRole("heading", {
        level: 3,
        name: new RegExp(`Checkpoint ${checkpoint}`, "u"),
      }),
    ).toBeVisible();
  }

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");
  await page.reload();
  await expect(page.locator("#section-8-worked-example")).toBeVisible();

  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("阈值与形态学正文呈现 binary contract、结构变化与失败诊断闭环", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-threshold-morphology/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /阈值与形态学/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(9);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("pixel > T");
  await expect(document).toContainText("pixel == T");
  await expect(document).toContainText("ret == 127.0");
  await expect(document).toContainText("THRESH_BINARY_INV");
  await expect(document).toContainText("mask_bool.astype(np.uint8) * 255");
  await expect(document).toContainText("Structuring element 不是 averaging kernel");
  await expect(document).toContainText("erosion（腐蚀）");
  await expect(document).toContainText("opening（开运算）");
  await expect(document).toContainText("foreground\": 2, \"target\": 0");
  await expect(document).toContainText("foreground\": 117, \"target\": 35");
  await expect(document).toContainText("inspect_binary(\"opened\", opened, source.shape) == 30");
  await expect(document).toContainText("inspect_binary(\"cleaned\", cleaned, source.shape) == 35");
  await expect(document).toContainText("np.count_nonzero(aggressive_open) == 0");
  await expect(document).toContainText("并不等价于“默认外部全是 0”");
  for (const checkpoint of [1, 2, 3, 4]) {
    await expect(
      document.getByRole("heading", {
        level: 3,
        name: new RegExp(`Checkpoint ${checkpoint}`, "u"),
      }),
    ).toBeVisible();
  }

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");
  await page.reload();
  await expect(page.locator("#section-8-worked-example")).toBeVisible();

  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("边缘与轮廓正文呈现有符号响应、数据契约、已知几何与失败诊断闭环", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-edges-contours/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /边缘、轮廓与区域测量/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(7);
  await expect(document.getByRole("table")).toHaveCount(2);
  await expect(document).toContainText("edge map 的 255 是边界证据");
  await expect(document).toContainText("sobel_positive[3, 4]");
  await expect(document).toContainText("-760.0");
  await expect(document).toContainText('"total": 403, "known main": 25, "off": 359');
  await expect(document).toContainText("contour.shape == (4, 1, 2)");
  await expect(document).toContainText("foreground_pixels == 40");
  await expect(document).toContainText("area == 28.0");
  await expect(document).toContainText("perimeter == 22.0");
  await expect(document).toContainText("(x, y, w, h) == (3, 2, 8, 5)");
  await expect(document).toContainText("result = source_bgr.copy()");
  for (const checkpoint of [1, 2, 3, 4]) {
    await expect(
      document.getByRole("heading", {
        level: 3,
        name: new RegExp(`Checkpoint ${checkpoint}`, "u"),
      }),
    ).toBeVisible();
  }

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");
  await page.reload();
  await expect(page.locator("#section-8-worked-example")).toBeVisible();

  await expect(
    page
      .getByLabel("精选学习资源")
      .getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("批处理正文呈现确定性 discovery、失败记录、manifest 与 rerun 闭环", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  await page.goto("/knowledge/pipeline-batch-images/");

  const document = page.locator(".learning-document");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /批处理、配置、结果保存与日志/u,
    }),
  ).toBeVisible();
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(11);
  await expect(document.locator('[data-code-language="json"]')).toHaveCount(1);
  await expect(document).toContainText(
    "discover → sort → preflight → process one → record → summarize → verify",
  );
  await expect(document).toContainText("Path.iterdir()");
  await expect(document).toContainText("continue-on-item-error");
  await expect(document).toContainText("error-on-existing");
  await expect(document).toContainText("processed == succeeded + failed");
  await expect(document).toContainText("discovered == processed + skipped");
  await expect(document).toContainText("counts consistent ≠ records complete");
  await expect(document).toContainText("validate_record_identities");
  await expect(document).toContainText("np.array_equal(pixels_a, pixels_b)");
  await expect(document).toContainText("assert before_rerun == after_rerun");
  for (const checkpoint of [1, 2, 3, 4, 5]) {
    await expect(
      document.getByRole("heading", {
        level: 3,
        name: new RegExp(`Checkpoint ${checkpoint}`, "u"),
      }),
    ).toBeVisible();
  }

  const toc = page.locator('[data-concept-toc="desktop"]');
  const workedExampleLink = toc.getByRole("link", {
    name: /8\. Worked Example/u,
  });
  await workedExampleLink.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
    .toBe("#section-8-worked-example");
  await page.reload();
  await expect(page.locator("#section-8-worked-example")).toBeVisible();

  const resources = page.getByLabel("精选学习资源");
  await expect(
    resources.getByRole("link", {
      name: "pathlib — Object-oriented filesystem paths",
      exact: true,
    }),
  ).toHaveAttribute("href", "/resources/python-pathlib/");
  await expect(
    resources.getByRole("link", { name: "OpenCV-Python Tutorials", exact: true }),
  ).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Feature Preview 的三个 checkpoint、understand 边界和深链接可访问", async ({ page }) => {
  const errors = trackBrowserErrors(page);
  await page.goto("/knowledge/opencv-features-preview/");
  const document = page.locator(".learning-document");
  await expect(document.getByRole("heading", { level: 1 })).toContainText("局部特征预览");
  await expect(document.locator('[data-code-language="python"]')).toHaveCount(3);
  await expect(document.getByRole("table")).toHaveCount(2);
  for (const checkpoint of [1, 2, 3]) {
    await expect(document.getByRole("heading", { level: 3, name: new RegExp(`Checkpoint ${checkpoint}`, "u") })).toBeVisible();
  }
  await expect(document).toContainText("达到 understood 即满足本节点路线目标");
  await expect(document).toContainText("if description is None:");
  await expect(document).toContainText("orb.descriptorSize()");
  await expect(document).toContainText("模糊不保证点数单调减少");
  await expect(page.locator("[data-concept-project-id]")).toHaveCount(0);
  const toc = page.locator('[data-concept-toc="desktop"]');
  await toc.getByRole("link", { name: /8\. Worked Example/u }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#section-8-worked-example");
  await page.reload();
  await expect(page.locator("#section-8-worked-example")).toBeVisible();
  const codeRegion = document.locator('[data-code-language="python"] pre').first();
  await codeRegion.focus();
  await expect(codeRegion).toBeFocused();
  const resource = page.getByLabel("精选学习资源").getByRole("link", { name: "OpenCV-Python Tutorials", exact: true });
  await expect(resource).toHaveAttribute("href", "/resources/opencv-python-tutorials/");
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("真实 GFM 表格保留语义并由独立容器承载", async ({ page }) => {
  await page.goto("/knowledge/linux-command-line-basics/");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const scrollContainer = table.locator("xpath=..");
  await expect(scrollContainer).toHaveClass(/table-scroll-container/);
  await scrollContainer.focus();
  await expect(scrollContainer).toBeFocused();
  await expect(page.getByRole("columnheader")).toHaveCount(4);
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

test("最小 fixture 在 360px 浏览器中正确呈现公式、表格与带图注图片", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await renderTechnicalFixture(page);

  await expect(page.locator("p .katex").first()).toBeVisible();
  const displayMath = page.locator(".katex-display");
  await expect(displayMath).toBeVisible();
  expect(await displayMath.evaluate((element) => getComputedStyle(element).overflowX)).toBe(
    "auto",
  );
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByAltText("普通 Markdown 图片")).toBeVisible();
  await expect(page.getByAltText("相机坐标投影示意图")).toBeVisible();
  await expect(page.getByText("图 1：测试 fixture 的图注。")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScan.violations).toEqual([]);
});

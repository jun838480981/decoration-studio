# public/fonts

P1-1（报价单 / 图册 PDF）用的**中文字体子集**放这里（SPEC §H.2）。

- 授权口径：**SIL OFL 1.1**（Noto Sans SC / Source Han Sans），**允许随 MIT 产物一同分发**（ADR-12）。
  → 字体不是 PDF 降级的原因；降级原因是体积与工时。
- 具体字体文件与体积预算待定（SPEC 待确认项 **C4**），落地后必须在 `docs/THIRD-PARTY.md` §4 登记。
- ⛔ 不要放任何 GPL / AGPL / 无 license 的字体；⛔ 不要提交未子集化的全量字体（体积）。
- 未嵌入 CJK 字体会导致 PDF 乱码（RISK-07），实现时必须用 `@pdf-lib/fontkit` 做子集化。
/**
 * @param {{draft: string, maxLength?: number}} props
 */
export function renderCaptureBox(props) {
  const draft = props.draft || ""
  const maxLength = props.maxLength || 240
  const disabled = draft.trim().length === 0 ? "disabled" : ""

  return `
    <section class="rp-capture">
      <textarea id="rp-capture-input" class="rp-capture-input" maxlength="${maxLength}" placeholder="记录新候选：例如“把右栏摘要改成按状态排序”...">${draft}</textarea>
      <div class="rp-capture-foot">
        <span class="rp-char-count">${draft.length}/${maxLength}</span>
        <button id="rp-capture-send" class="rp-capture-send" type="button" ${disabled}>发送</button>
      </div>
    </section>
  `
}


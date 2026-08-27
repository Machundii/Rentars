# TODO - #112 Implement dispute resolution flow

## Plan steps
- [x] Backend: add dispute raise/resolve methods in `apps/backend/src/services/booking.service.ts`
- [x] Backend: add notification types + notify both parties on raise/resolve
- [x] Backend: add routes/controllers for `POST /api/v1/bookings/:id/dispute` and `POST /api/v1/bookings/:id/dispute/resolve`


- [x] Backend: add validators for dispute request bodies
- [ ] Frontend: create `apps/web/src/components/booking/DisputeButton.tsx`
- [ ] Frontend: create `apps/web/src/components/booking/DisputeModal.tsx`
- [ ] Frontend: wire dispute raise endpoint call from modal
- [ ] UI placement: show DisputeButton on active bookings (align with existing booking status logic)
- [x] Update `ARCHITECTURE.md` with dispute resolution process
300-Line TODO — PropertyMapPin Accessibility Fix

Phase 1 — Understand the Existing Component

[ ] 001. Open the project in VS Code.

[ ] 002. Locate PropertyMapPin.tsx.

[ ] 003. Read the entire component before making changes.

[ ] 004. Identify the marker component being rendered.

[ ] 005. Identify whether the marker is a button.

[ ] 006. Identify whether the marker is a link.

[ ] 007. Identify whether the marker uses another interactive element.

[ ] 008. Find the existing accessible label.

[ ] 009. Check whether aria-label is currently present.

[ ] 010. Check whether aria-labelledby is currently present.

[ ] 011. Check whether an accessible name comes from visible text.

[ ] 012. Identify the property object used by the component.

[ ] 013. Identify the property title field.

[ ] 014. Determine whether the title can be undefined.

[ ] 015. Determine whether the title can be null.

[ ] 016. Determine whether the title can be an empty string.

[ ] 017. Determine whether the title can contain whitespace only.

[ ] 018. Check the property's TypeScript type.

[ ] 019. Check how the marker receives property data.

[ ] 020. Check whether multiple markers are rendered.

[ ] 021. Confirm every marker is interactive.

[ ] 022. Identify the marker click handler.

[ ] 023. Identify any navigation behavior.

[ ] 024. Identify any selection behavior.

[ ] 025. Identify any hover behavior.

[ ] 026. Identify any tooltip behavior.

[ ] 027. Identify the visible property title.

[ ] 028. Identify the visible property price.

[ ] 029. Confirm the price is not generated from the accessible label.

[ ] 030. Confirm the title display must remain unchanged.


Phase 2 — Understand Accessibility Requirements

[ ] 031. Confirm that every interactive marker needs an accessible name.

[ ] 032. Confirm the accessible name must never be empty.

[ ] 033. Confirm the accessible name must not be undefined.

[ ] 034. Confirm the accessible name must not be null.

[ ] 035. Confirm the accessible name must not be whitespace-only.

[ ] 036. Confirm the property title should be preferred.

[ ] 037. Define the fallback accessible label.

[ ] 038. Keep the fallback concise.

[ ] 039. Use a meaningful generic label.

[ ] 040. Prefer a label such as Property location.

[ ] 041. Avoid exposing internal property IDs.

[ ] 042. Avoid using technical identifiers as labels.

[ ] 043. Avoid using empty strings as fallbacks.

[ ] 044. Avoid changing visible content.

[ ] 045. Avoid changing marker dimensions.

[ ] 046. Avoid changing marker styling.

[ ] 047. Avoid changing marker positioning.

[ ] 048. Avoid changing marker animation.

[ ] 049. Avoid changing click behavior.

[ ] 050. Avoid changing keyboard behavior.


Phase 3 — Inspect Existing Tests

[ ] 051. Locate the test file for PropertyMapPin.

[ ] 052. Check whether tests use Vitest.

[ ] 053. Check whether tests use Jest.

[ ] 054. Check whether tests use React Testing Library.

[ ] 055. Read the existing test setup.

[ ] 056. Identify existing render helpers.

[ ] 057. Identify existing property fixtures.

[ ] 058. Identify existing mock functions.

[ ] 059. Identify existing click tests.

[ ] 060. Identify existing accessibility tests.

[ ] 061. Check whether the marker can already be queried by role.

[ ] 062. Check whether tests currently rely on text.

[ ] 063. Check whether tests currently rely on test IDs.

[ ] 064. Preserve the existing testing conventions.

[ ] 065. Avoid introducing unnecessary testing libraries.

[ ] 066. Check TypeScript configuration.

[ ] 067. Check test environment configuration.

[ ] 068. Check existing lint rules.

[ ] 069. Check formatting rules.

[ ] 070. Check the project's test command.


Phase 4 — Define Expected Behavior

[ ] 071. Define behavior when a property has a title.

[ ] 072. Define behavior when a property has no title.

[ ] 073. Define behavior when title is undefined.

[ ] 074. Define behavior when title is null.

[ ] 075. Define behavior when title is empty.

[ ] 076. Define behavior when title contains whitespace.

[ ] 077. Define behavior when title contains normal text.

[ ] 078. Define behavior when title contains special characters.

[ ] 079. Define behavior when title contains numbers.

[ ] 080. Define behavior when title is unusually long.

[ ] 081. Ensure the title is used as the accessible name when valid.

[ ] 082. Ensure the fallback is used when title is missing.

[ ] 083. Ensure the accessible name is always nonempty.

[ ] 084. Ensure the accessible name is stable.

[ ] 085. Ensure the accessible name is understandable.

[ ] 086. Ensure the accessible name is appropriate for screen readers.

[ ] 087. Ensure keyboard users can identify the marker.

[ ] 088. Ensure multiple markers remain distinguishable when titles exist.

[ ] 089. Ensure untitled markers still have a usable label.

[ ] 090. Document the expected behavior in tests.


Phase 5 — Implement the Accessible Label

[ ] 091. Open PropertyMapPin.tsx.

[ ] 092. Locate the interactive marker element.

[ ] 093. Identify where its accessible label is assigned.

[ ] 094. Determine whether the label can be calculated inline.

[ ] 095. Determine whether a local variable improves readability.

[ ] 096. Use the property title when present.

[ ] 097. Add the generic fallback when the title is missing.

[ ] 098. Ensure the fallback is a string.

[ ] 099. Ensure the resulting label is never empty.

[ ] 100. Ensure the label is passed to the marker.

[ ] 101. Keep the change limited to accessibility.

[ ] 102. Do not alter the marker's visual markup unnecessarily.

[ ] 103. Do not alter the marker's price rendering.

[ ] 104. Do not alter the marker's title rendering.

[ ] 105. Do not alter the click handler.

[ ] 106. Do not alter navigation logic.

[ ] 107. Do not alter property selection logic.

[ ] 108. Do not alter event propagation.

[ ] 109. Do not alter map behavior.

[ ] 110. Do not alter styling.

[ ] 111. Do not alter marker positioning.

[ ] 112. Do not alter animations.

[ ] 113. Do not alter loading behavior.

[ ] 114. Do not alter data fetching.

[ ] 115. Do not alter unrelated components.


Phase 6 — Handle Missing Titles Safely

[ ] 116. Test the normal title case mentally.

[ ] 117. Test undefined title behavior.

[ ] 118. Test null title behavior if the type permits it.

[ ] 119. Test empty-string behavior.

[ ] 120. Test whitespace-only behavior.

[ ] 121. Decide whether whitespace should count as missing.

[ ] 122. Keep the implementation consistent with project conventions.

[ ] 123. Prevent accidental "undefined" labels.

[ ] 124. Prevent accidental "null" labels.

[ ] 125. Prevent empty accessible names.

[ ] 126. Prevent labels containing only spaces.

[ ] 127. Ensure the fallback is deterministic.

[ ] 128. Ensure the fallback does not depend on random data.

[ ] 129. Ensure the fallback does not depend on rendering state.

[ ] 130. Ensure the fallback works for every property.


Phase 7 — Add Titled Property Tests

[ ] 131. Create or update the PropertyMapPin test suite.

[ ] 132. Create a titled property fixture.

[ ] 133. Give the fixture a realistic property title.

[ ] 134. Render the marker with the titled property.

[ ] 135. Query the interactive marker by role.

[ ] 136. Query it using its accessible name.

[ ] 137. Assert that the marker exists.

[ ] 138. Assert that the accessible name equals the property title.

[ ] 139. Confirm the title is not replaced unnecessarily.

[ ] 140. Confirm no generic fallback is used for titled properties.

[ ] 141. Confirm the visible title remains unchanged.

[ ] 142. Confirm the visible price remains unchanged.

[ ] 143. Confirm the marker remains interactive.

[ ] 144. Confirm the existing click handler still works.

[ ] 145. Keep the test focused on the requested behavior.


Phase 8 — Add Untitled Property Tests

[ ] 146. Create an untitled property fixture.

[ ] 147. Set the title to undefined if supported.

[ ] 148. Render the marker.

[ ] 149. Query the marker by role.

[ ] 150. Query it using the fallback accessible name.

[ ] 151. Assert that the marker exists.

[ ] 152. Assert that the accessible name is nonempty.

[ ] 153. Assert that the fallback label is used.

[ ] 154. Confirm the fallback is concise.

[ ] 155. Confirm the fallback is meaningful.

[ ] 156. Confirm the marker remains clickable.

[ ] 157. Confirm the click callback is still triggered.

[ ] 158. Confirm no visible UI changes occurred.

[ ] 159. Confirm the price remains unchanged.

[ ] 160. Confirm unrelated property information remains unchanged.


Phase 9 — Add Edge-Case Tests

[ ] 161. Test an empty-string title.

[ ] 162. Verify the fallback is used for an empty title.

[ ] 163. Test a whitespace-only title.

[ ] 164. Verify the fallback is used when appropriate.

[ ] 165. Test a normal multi-word title.

[ ] 166. Verify the exact title is used.

[ ] 167. Test a title containing numbers.

[ ] 168. Verify the number-containing title works.

[ ] 169. Test a title containing punctuation.

[ ] 170. Verify punctuation does not break the label.

[ ] 171. Test a title containing apostrophes.

[ ] 172. Test a title containing ampersands.

[ ] 173. Test a title containing Unicode characters.

[ ] 174. Test a long but valid property title.

[ ] 175. Ensure long titles remain accessible.

[ ] 176. Ensure no unexpected fallback is introduced.

[ ] 177. Test the marker without optional title data.

[ ] 178. Ensure the marker still renders.

[ ] 179. Ensure the marker remains keyboard accessible.

[ ] 180. Ensure the marker remains screen-reader accessible.


Phase 10 — Preserve Click Behavior

[ ] 181. Locate the marker's click callback.

[ ] 182. Create a mock click handler if one does not exist.

[ ] 183. Render the marker with the click handler.

[ ] 184. Find the marker by accessible role and name.

[ ] 185. Trigger a click.

[ ] 186. Assert that the callback was called.

[ ] 187. Verify it was called the expected number of times.

[ ] 188. Test clicking a titled marker.

[ ] 189. Test clicking an untitled marker.

[ ] 190. Verify the fallback label does not interfere with clicks.

[ ] 191. Verify the title label does not interfere with clicks.

[ ] 192. Verify event handling remains unchanged.

[ ] 193. Verify navigation remains unchanged if applicable.

[ ] 194. Verify property selection remains unchanged if applicable.

[ ] 195. Verify map interactions remain unchanged.


Phase 11 — Preserve Visible Content

[ ] 196. Identify the rendered price element.

[ ] 197. Add or preserve a price assertion.

[ ] 198. Render the titled property.

[ ] 199. Verify the expected price is visible.

[ ] 200. Render the untitled property.

[ ] 201. Verify the expected price remains visible.

[ ] 202. Identify the visible property title element.

[ ] 203. Verify titled property text remains visible.

[ ] 204. Verify untitled property display remains unchanged.

[ ] 205. Ensure aria-label does not replace visible content.

[ ] 206. Ensure no text is added to the visual marker.

[ ] 207. Ensure no fallback text appears visually.

[ ] 208. Ensure CSS remains unchanged.

[ ] 209. Ensure layout remains unchanged.

[ ] 210. Ensure marker dimensions remain unchanged.


Phase 12 — Accessibility Verification

[ ] 211. Verify every interactive marker has an accessible name.

[ ] 212. Verify titled markers use their titles.

[ ] 213. Verify untitled markers use the fallback.

[ ] 214. Verify empty labels are impossible.

[ ] 215. Verify undefined labels are impossible.

[ ] 216. Verify null labels are impossible.

[ ] 217. Verify screen readers receive the intended name.

[ ] 218. Verify keyboard users can identify markers.

[ ] 219. Verify markers remain focusable where required.

[ ] 220. Verify focus behavior remains unchanged.

[ ] 221. Verify the label describes the marker accurately.

[ ] 222. Verify the fallback does not expose implementation details.

[ ] 223. Verify accessibility semantics are not duplicated.

[ ] 224. Check for conflicting aria-* attributes.

[ ] 225. Remove unnecessary accessibility attributes only if directly related.


Phase 13 — Test Suite Quality

[ ] 226. Run the targeted PropertyMapPin tests.

[ ] 227. Confirm titled-property tests pass.

[ ] 228. Confirm untitled-property tests pass.

[ ] 229. Confirm click tests pass.

[ ] 230. Confirm visible-content tests pass.

[ ] 231. Run edge-case tests.

[ ] 232. Check for flaky tests.

[ ] 233. Ensure tests do not depend on timing.

[ ] 234. Ensure tests do not depend on random data.

[ ] 235. Ensure tests use stable queries.

[ ] 236. Prefer role/name queries for accessibility behavior.

[ ] 237. Avoid testing implementation details unnecessarily.

[ ] 238. Keep fixtures readable.

[ ] 239. Keep assertions specific.

[ ] 240. Keep test descriptions clear.


Phase 14 — Run Project Checks

[ ] 241. Run the project's lint command.

[ ] 242. Fix lint issues caused by the change.

[ ] 243. Run the formatter.

[ ] 244. Verify formatting.

[ ] 245. Run TypeScript type checking.

[ ] 246. Fix type errors.

[ ] 247. Run the complete test suite.

[ ] 248. Confirm unrelated tests still pass.

[ ] 249. Check for new warnings.

[ ] 250. Check the browser console.

[ ] 251. Check the terminal output.

[ ] 252. Verify there are no runtime errors.

[ ] 253. Verify there are no accessibility warnings.

[ ] 254. Verify there are no React warnings.

[ ] 255. Verify there are no TypeScript warnings.


Phase 15 — Manual Verification

[ ] 256. Start the development server.

[ ] 257. Open the application in a browser.

[ ] 258. Navigate to the property map.

[ ] 259. Locate a property with a title.

[ ] 260. Confirm its visible title is unchanged.

[ ] 261. Confirm its visible price is unchanged.

[ ] 262. Inspect its accessible name.

[ ] 263. Confirm the title is used as its accessible name.

[ ] 264. Locate a property without a title.

[ ] 265. Inspect its accessible name.

[ ] 266. Confirm the fallback label is present.

[ ] 267. Confirm the fallback is nonempty.

[ ] 268. Confirm the marker can still be clicked.

[ ] 269. Confirm clicking opens/selects the expected property.

[ ] 270. Confirm no visual regression occurred.


Phase 16 — Final Review & Acceptance

[ ] 271. Review the production code diff.

[ ] 272. Confirm only the accessible-label logic changed.

[ ] 273. Confirm tests cover titled properties.

[ ] 274. Confirm tests cover untitled properties.

[ ] 275. Confirm tests cover click behavior.

[ ] 276. Confirm visible price remains unchanged.

[ ] 277. Confirm visible title remains unchanged.

[ ] 278. Confirm marker styling remains unchanged.

[ ] 279. Confirm marker positioning remains unchanged.

[ ] 280. Confirm keyboard behavior remains unchanged.

[ ] 281. Confirm every marker has a nonempty accessible name.

[ ] 282. Confirm fallback behavior is deterministic.

[ ] 283. Confirm no unrelated files were modified.

[ ] 284. Confirm no unnecessary dependencies were added.

[ ] 285. Confirm no secrets were introduced.

[ ] 286. Confirm lint passes.

[ ] 287. Confirm type checking passes.

[ ] 288. Confirm targeted tests pass.

[ ] 289. Confirm the full test suite passes.

[ ] 290. Confirm the application builds successfully.

[ ] 291. Confirm the production build succeeds.

[ ] 292. Review the final accessibility behavior.

[ ] 293. Review the final user interaction behavior.

[ ] 294. Review the final visible UI.

[ ] 295. Review the final test coverage.

[ ] 296. Review the final Git diff.

[ ] 297. Write a concise change summary.

[ ] 298. Record the tests that were run.

[ ] 299. Confirm all acceptance criteria are satisfied.

[ ] 300. Commit the completed accessibility fix.

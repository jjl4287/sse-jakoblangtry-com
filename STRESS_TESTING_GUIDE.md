# 🚀 STRESS TESTING GUIDE
## Bulletproof Board Operations

### 🎯 **Quick Stress Tests**

#### **Test 1: Rapid Card Movements** 
1. Open a board with multiple columns and cards
2. **Drag cards rapidly** between columns (as fast as possible)
3. **Expected Result**: All moves should complete, no "Failed to move card" errors
4. **Console Check**: Look for operation merging logs like `🔄 Merged operation card_move_xyz`

#### **Test 2: Column Reordering Frenzy**
1. Grab a column and move it back and forth rapidly
2. **Try to "confuse" the system** with overlapping drags
3. **Expected Result**: Final position should be accurate, no data loss
4. **Console Check**: Operations should be merged, not duplicated

#### **Test 3: Mixed Rapid Operations**
1. **Simultaneously** drag cards AND reorder columns
2. Do this as quickly as possible for 30 seconds
3. **Expected Result**: All operations complete successfully
4. **Check**: Refresh the page - all positions should be preserved

---

### 🔧 **Advanced Stress Tests**

#### **Test 4: Network Disruption Simulation**
1. Open browser DevTools → Network tab
2. Start dragging operations
3. **Set network to "Slow 3G" or "Offline"** mid-operation
4. **Expected Result**: Operations queue up, then sync when connection returns
5. **Console Check**: Should see retry attempts with exponential backoff

#### **Test 5: Server Error Simulation**
1. In DevTools Network tab, block API requests to `/api/cards/*/move`
2. Try moving cards
3. **Expected Result**: Operations retry automatically, eventually show error toast
4. **Recovery**: Unblock requests, operations should succeed on retry

#### **Test 6: Memory & Performance**
1. Open DevTools → Performance tab
2. **Perform 100+ rapid operations** (cards + columns)
3. **Check**: Memory usage should remain stable, no leaks
4. **Verify**: No performance degradation after extended use

---

### 📊 **What to Monitor**

#### **Console Output (Success Indicators)**
```
🔄 Processing 3 operations...
🔄 Merged operation card_move_abc123
✅ Batch processing completed
```

#### **Error Indicators (Should Auto-Recover)**
```
❌ Operation card_move_xyz failed (attempt 1): HTTP 500
🔄 Processing 1 operations... (retry)
✅ Batch processing completed (success on retry)
```

#### **Performance Metrics**
- **Response Time**: UI should feel instant (0-10ms)
- **API Calls**: Should see operation merging reducing total calls
- **Memory**: DevTools memory tab should show stable usage
- **CPU**: No sustained high CPU usage during operations

---

### 🎪 **Extreme Stress Tests**

#### **Test 7: The "Chaos Test"**
1. **Get aggressive**: Try to break the system
2. Drag multiple cards simultaneously (if possible)
3. Rapidly switch between tabs while dragging
4. **Hammer the board** with operations for 2-3 minutes straight
5. **Expected**: System should remain responsive and accurate

#### **Test 8: Long Session Test**
1. Use the board normally for 30+ minutes
2. Perform hundreds of operations
3. **Check**: No memory leaks, consistent performance
4. **Verify**: All data preserved after page refresh

#### **Test 9: "Race Condition Hunter"**
1. Open **multiple browser tabs** of the same board
2. Perform operations simultaneously in different tabs
3. **Expected**: Last operation should win, no data corruption
4. **Verify**: Final state is consistent across all tabs

---

### 🚨 **What Should NEVER Happen**

#### **❌ Fatal Errors (Now Prevented)**
- ~~"Failed to move card" with no retry~~
- ~~Cards disappearing or appearing in wrong columns~~
- ~~Page crashes or forced refreshes~~
- ~~Data loss after rapid operations~~
- ~~Memory leaks causing browser slowdown~~

#### **✅ Expected Behaviors**
- **Instant UI feedback** for all operations
- **Automatic retries** for failed operations
- **Clear error messages** with toast notifications
- **Graceful degradation** during network issues
- **100% data preservation** even under stress

---

### 🔍 **Debugging Commands**

#### **Check Operation Queue Status**
```javascript
// In browser console (if debugging features enabled)
console.log(window.boardMutations?.getOperationStatus?.());
// Should show: { pending: 0, processing: 0, failed: 0, total: 0 }
```

#### **Monitor Network Requests**
1. DevTools → Network tab
2. Filter by `/api/cards` and `/api/columns`
3. **Look for**: Reduced API calls due to operation merging
4. **Verify**: Retry attempts with 1s, 2s, 4s intervals

#### **Performance Profiling**
1. DevTools → Performance tab → Record
2. Perform stress test operations
3. **Check**: No long tasks or memory spikes
4. **Verify**: Consistent frame rates during operations

---

### 📈 **Success Criteria**

#### **✅ Passing Grades**
- **99%+ operation success rate** under normal use
- **95%+ success rate** under extreme stress testing
- **Zero data loss** events in any scenario
- **Sub-100ms UI response** times for all operations
- **Automatic recovery** from all network/server errors

#### **🏆 Excellence Indicators**
- Operations feel **instantaneous** even under stress
- **No user intervention** required for error recovery
- **Stable memory usage** during extended sessions
- **Consistent behavior** across different network conditions
- **Bulletproof reliability** that users can depend on

---

### 🎯 **Quick Verification Checklist**

Before reporting any issues, please verify:

- [ ] Browser console shows no persistent errors
- [ ] All operations eventually complete (may take a few retries)
- [ ] Page refresh preserves all data correctly
- [ ] Memory usage remains stable in DevTools
- [ ] Network errors auto-recover when connection returns
- [ ] UI remains responsive during stress testing
- [ ] Toast notifications provide clear feedback
- [ ] No data loss or corruption under any scenario

**If all items check out: 🎉 Your board system is stress-test ready!**

---

### 🆘 **If You Find Issues**

#### **Reporting Format**
1. **Test performed**: Which stress test were you running?
2. **Steps to reproduce**: Exact sequence of actions
3. **Expected vs Actual**: What should happen vs what happened
4. **Console output**: Any error messages or logs
5. **Network conditions**: Online, offline, slow connection?
6. **Recovery**: Did the system auto-recover or require manual intervention?

The new system is designed to handle **99% of stress scenarios** automatically. Any edge cases found help improve the system further! 🚀 
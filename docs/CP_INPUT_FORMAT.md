# Competitive Programming (CP) Input Format Specification

## 🚨 MANDATORY INPUT RULES (NO EXCEPTIONS)

ALL inputs on this platform **MUST** be in strict Competitive Programming (CP) format.

### ❌ ABSOLUTELY FORBIDDEN

- JSON arrays: `[1, 2, 3, 4]`
- JSON 2D arrays: `[[1,2],[3,4]]`
- JSON objects: `{"nums": [1,2,3], "target": 5}`
- LeetCode-style: `nums = [1,2,3]`
- Brackets in any form: `[1 2 3]` or `(1, 2, 3)`
- Comma-separated values: `1,2,3,4`
- `getline` for array parsing in C++
- Character-by-character parsing

### ✅ CORRECT INPUT FORMATS

#### Single Value
```
n
```

#### 1D Array
```
n
a1 a2 a3 ... an
```
Example:
```
5
1 3 5 7 9
```

#### 2D Array / Matrix (Fixed Dimensions)
```
r c
row1_elements (space-separated)
row2_elements
...
```
Example:
```
3 4
1 2 3 4
5 6 7 8
9 10 11 12
```

#### 2D Array / K Sorted Arrays (Variable Row Lengths)
```
k
len1
arr1_elements
len2
arr2_elements
...
```
Example (for k-th smallest in merged arrays):
```
3
3
1 3 5
4
2 4 6 8
2
7 9
```

#### Two Arrays
```
n m
arr1_elements (n elements)
arr2_elements (m elements)
```

#### Array with Target/Parameter
```
n k
arr_elements
```
Or:
```
n
arr_elements
target
```

#### Linked List (with Cycle Position)
```
n
node_values (space-separated)
pos (-1 for no cycle)
```
Example:
```
4
3 2 0 -4
1
```

#### Graph (Edge List)
```
n e
u1 v1 [w1]
u2 v2 [w2]
...
```

#### Tree (Edge List)
```
n
u1 v1
u2 v2
...
```

#### String Input
```
len
string_content
```
Or just:
```
string_content
```

---

## 🧪 Example Comparison

### Problem: K-th Smallest in K Sorted Arrays

#### ❌ WRONG (JSON format - DO NOT USE)
```
k = 4
[[1,3,5],[2,4,6]]
```

#### ✅ CORRECT (CP format)
```
4
2
3
1 3 5
3
2 4 6
```
Breakdown:
- Line 1: k = 4 (find 4th smallest)
- Line 2: number of arrays = 2
- Line 3: length of first array = 3
- Line 4: first array elements
- Line 5: length of second array = 3
- Line 6: second array elements

---

## 🧠 WHY CP FORMAT ONLY?

1. **Deterministic**: No parsing ambiguity
2. **Fast**: Direct integer/string reads, no JSON parsing overhead
3. **Judge-Compatible**: Matches competitive programming judges (Codeforces, USACO, etc.)
4. **Reliable**: Eliminates partial passes (7/17, 12/15) caused by format issues

---

## 📝 Solution Template (C++)

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int n;
    cin >> n;
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    // Your solution here
    
    cout << result << endl;
    return 0;
}
```

## 📝 Solution Template (Python)

```python
import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))

# Your solution here

print(result)
```

## 📝 Solution Template (Java)

```java
import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st;
        
        int n = Integer.parseInt(br.readLine().trim());
        
        st = new StringTokenizer(br.readLine());
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = Integer.parseInt(st.nextToken());
        }
        
        // Your solution here
        
        System.out.println(result);
    }
}
```

---

## 🔧 For Test Case Authors

When creating test cases, ALWAYS use the CP format utilities:

```javascript
import {
  arrayToCPFormat,
  kArraysToCPFormat,
  linkedListToCPFormat,
  matrix2DToCPFormat,
  graphToCPFormat,
} from '../utils/cpInputFormat.js';

// 1D Array
const stdin = arrayToCPFormat([1, 3, 5, 7, 9]);
// Output: "5\n1 3 5 7 9"

// K Sorted Arrays
const stdin = kArraysToCPFormat([[1, 3, 5], [2, 4, 6]]);
// Output: "2\n3\n1 3 5\n3\n2 4 6"

// Linked List with Cycle
const stdin = linkedListToCPFormat([3, 2, 0, -4], 1);
// Output: "4\n3 2 0 -4\n1"
```

---

## ⚠️ Migration Note

Existing test cases with JSON format will be automatically converted to CP format during generation. However, all NEW test cases MUST be authored in CP format from the start.

---
title: Topic 4.2
date: 2026-10-14
tags: [算法基础]
summary: 最小/最大值、期望线性时间选择、最坏情况线性时间选择
---

# 一、最大值与最小值

## 1. 单独求解最小值

### 算法伪代码

```pseudocode MINIMUM(A)
min = A[1]
for i = 2 to A.length do
    if min > A[i] then
        min = A[i]
return min
```

*   下界：至少需要 n - 1 次比较
*   算法 MINIMUM(A)：遍历数组，维护当前最小值
*   时间复杂度：$Θ(n)$，比较次数 n-1

## 2. 同时求解最大/最小值

### 算法伪代码

```pseudocode MAX-MIN(A)
if A[1] > A[2] then min = A[2],max = A[1]
else min = A[1],max = A[2]

for i = 2 to ⌊n/2⌋ do
    if A[2i−1] > A[2i]
        then if A[2i] < min then min = A[2i]
            if A[2i−1] > max then max = A[2i−1]
        else if A[2i−1] < min then min = A[2i−1]
            if A[2i] > max then max = A[2i]
if n̸ =2⌊n/2⌋ then if A[n] < min then min = A[n]
                if A[n] > max then max = A[n]
return (min,max)
```

*   简单方法：分别求最小和最大，共 2n - 2 次比较
*   优化方法 MAX-MIN(A)：
    *   成对处理元素，每对先比较一次，分出较小者和较大者
    *   较小者只与当前 min 比较，较大者只与当前 max 比较
    *   每对元素最多 3 次比较
*   总比较次数：
    *   n 为奇数：$3⌊n/2⌋$ 次
    *   n 为偶数：$1 + 3(n-2)/2 = 3n/2 - 2$ 次
    *   统一上界：最多 $3⌊n/2⌋$ 次比较

# 二、期望线性时间选择

## 1. 随机选择算法

### ① 基本思想

RANDOMIZED-SELECT 使用分治策略，类似于快速排序，但是我们只需要递归一侧，因为我们只需要找第 $i$ 小的元素。划分后，主元已经处于正确位置，我们只需要判断第 $i$ 小在左边还是右边，然后只递归那一侧即可

### ② 伪代码

```pseudocode RANDOMIZED-SELECT(A, p, r, i)
if p == r then
    return A[p]                    // 只有一个元素，直接返回
q = RANDOMIZED-PARTITION(A, p, r)  // 随机划分
k = q - p + 1                      // 主元是第 k 小
if i == k then
    return A[q]                    // 主元就是答案
if i < k then
   return RANDOMIZED-SELECT(A, p, q-1, i)      // 在左边找第 i 小
else
    return RANDOMIZED-SELECT(A, q+1, r, i-k)    // 在右边找第 i-k 小
```

**复杂度与性质：**

- Worst：$\Theta(n^2)$
- Expected：$\Theta(n)$
```fold 期望情况分析
设 $T(n)$ 为在 n 个元素的数组上运行的时间

定义随机变量 $X_k = \{子数组 A[p..q] 恰好有 k 个元素\}$

由于主元的选择是随机的，因此 $E[X_k] = \frac{1}{n}$

当 $X_k = 1$ 时，两个可能的递归子数组大小分别为：

* 左部分：$k - 1$ 个元素
* 右部分：$n - k$ 个元素

我们只递归其中较大的那个（最坏情况）：

$$
\max(k - 1, n - k)
$$

**建立递归式**

$$
T(n) \le \sum_{k=1}^{n} X_k \cdot T(\max(k-1, n-k)) + O(n)
$$

解释：无论主元是第几小，我们都要花 $O(n)$ 时间做划分，然后递归处理较大的那一侧

两边取期望：

$$
E[T(n)] \le E\left[ \sum_{k=1}^{n} X_k T(\max(k-1, n-k)) \right] + O(n)
$$

利用期望的线性性和 $X_k$ 与 $T(\max(k-1, n-k))$ 的独立性：

$$
E[T(n)] \le \sum_{k=1}^{n} E[X_k] \cdot E[T(\max(k-1, n-k))] + O(n)
$$

代入 $E[X_k] = 1/n$：

$$
E[T(n)] \le \frac{1}{n} \sum_{k=1}^{n} E[T(\max(k-1, n-k))] + O(n)
$$

由对称性：

$$
E[T(n)] \le \frac{2}{n} \sum_{k=\lfloor n/2 \rfloor}^{n-1} E[T(k)] + O(n)
$$

**代入归纳假设**

假设对于所有小于 n 的情况，$T(k) \le ck$（c 为某常数）

$$
E[T(n)] \le \frac{2}{n} \sum_{k=\lfloor n/2 \rfloor}^{n-1} ck + an
$$

其中 $an$ 是 $O(n)$ 项的上界

计算求和：

$$
\sum_{k=\lfloor n/2 \rfloor}^{n-1} k = \sum_{k=1}^{n-1} k - \sum_{k=1}^{\lfloor n/2 \rfloor - 1} k = \frac{(n-1)n}{2} - \frac{(\lfloor n/2 \rfloor - 1)\lfloor n/2 \rfloor}{2}
$$

代入并放缩（用 $n/2$ 代替 $\lfloor n/2 \rfloor$ 进行上界估计）：

$$
E[T(n)] \le \frac{2c}{n} \left( \frac{(n-1)n}{2} - \frac{(n/2 - 2)(n/2 - 1)}{2} \right) + an
$$

化简括号内：

$$
\begin{aligned}
&= \frac{2c}{n} \cdot \frac{1}{2} \left( n^2 - n - \left( \frac{n^2}{4} - \frac{3n}{2} + 2 \right) \right) + an \\[1em]
&= \frac{c}{n} \left( \frac{3n^2}{4} + \frac{n}{2} - 2 \right) + an \\[1em]
&= c \left( \frac{3n}{4} + \frac{1}{2} - \frac{2}{n} \right) + an \\[1em]
&\le \frac{3cn}{4} + \frac{c}{2} + an \\[1em]
&= cn - \left( \frac{cn}{4} - \frac{c}{2} - an \right)
\end{aligned}
$$

**选择常数 c**

要使 $E[T(n)] \le cn$，需要：

$$
\frac{cn}{4} - \frac{c}{2} - an \ge 0
$$

即：

$$
n \left( \frac{c}{4} - a \right) \ge \frac{c}{2}
$$

只要 $c > 4a$，就能找到足够大的 n 使不等式成立。对于较小的 n（$n < \frac{2c}{c-4a}$ ），假设 $T(n) = O(1)$

因此：

$$
E[T(n)] = O(n)
$$
```

## 2. 选择算法

### ① 基本思想

步骤：

1. 将 n 个元素分成 $\lceil n/5 \rceil$ 组，每组 5 个元素，剩余 n mod 5 个元素单独一组
2. 找出每组的中位数（每组最多 5 个，可直接比较）
3. 递归调用 SELECT 找出这些中位数的中位数 x（median-of-medians）
4. 用修改后的 PARTITION 以 x 为基准划分数组，得到 x 是第 k 小
5. 若 i == k，返回 x；若 i < k，递归低区；若 i > k，递归高区找第 i-k 小

**复杂度：**
- Worst：$O(n)$

```fold 最坏情况分析
* 关键：划分后，至少有多少元素大于 x ？
    * 除了 x 所在组和不足 5 个元素的组外，至少一半的组贡献 3 个大于 x 的元素。
    * 大于 x 的元素至少：
    
      $$
      3 \left( \left\lceil \frac{1}{2} \left\lfloor \frac{n}{5} \right\rfloor \right\rceil - 2 \right) \ge \frac{3n}{10} - 6
      $$
      
    * 因此，递归调用最多处理：
    
      $$
      n - \left( \frac{3n}{10} - 6 \right) = \frac{7n}{10} + 6
      $$
      
      个元素
      
* 递归式：

  $$
  T(n) \le 
  \begin{cases} 
  \Theta(1) & n \le 140 \\ 
  T(\lceil n/5 \rceil) + T(7n/10 + 6) + O(n) & n > 140 
  \end{cases}
  $$

* 假设 $T(n) \le cn$，代入：

  $$
  T(n) \le c\lceil n/5 \rceil + c(7n/10 + 6) + an \le 9cn/10 + 7c + an = cn + (-cn/10 + 7c + an)
  $$

    * 当 $-cn/10 + 7c + an \le 0$，即 $c \ge 10a \cdot n/(n - 70)$
    * 当 $n \ge 140$ 时，$n/(n - 70) \le 2$，所以选 $c \ge 20a$ 即可
    * 因此 $T(n) = O(n)$，**最坏情况线性时间**
    
* 算法正确性条件：每组元素个数 r 为奇数且 $r \ge 5$ 即可
```
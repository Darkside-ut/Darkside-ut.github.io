---
title: Topic 3
date: 2026-10-10
tags: [算法基础]
summary: 基于比较的排序算法，介绍六种排序算法以及优先队列的数据结构
---

# 一、关于排序算法的若干概念

## 1. 稳定性 Stability

如果待排序序列中**存在两个相等的元素**，排序前它们的相对顺序与排序后它们的相对顺序保持不变，则该排序算法是稳定的；否则是不稳定的

> 稳定性只对基于比较且存在相等关键字的情况有意义。若所有关键字互不相同，则稳定性无从体现

## 2. 时间复杂度

通常使用算法执行过程中元素的比较次数和移动次数来衡量

## 3. 就地排序 In-place Sorting

如果排序算法在排序过程中只使用常数级别 $O(1)$ 的额外辅助空间，则称该算法为就地排序

# 二、简单排序算法

## 1. 插入排序

对插入排序的详细介绍看 [Topic1](#/blog/algorithm1)

**复杂度与性质：**

- Best：$O(n)$
- Average/Worst：$O(n^2)$
- Auxiliary Space：$O(1)$
- Stable：Yes



## 2. 选择排序

### ① 基本思想

从未排序的后缀中选出最小元素，放到下一个位置

### ② 伪代码

```pseudocode Selection-Sort(A)
for i = 1 to A.length - 1 do
    k = i
    for j = i + 1 to A.length do
        if A[j] < A[k] then
            k = j
    if k ≠ i then
        A[i] ↔ A[k]
@note 很明显，交换的过程可能将位置靠后的相同元素移到前面，从而破坏稳定性
@note eg：[5a, 5b, 2]，第一次交换时，5a 与 2 交换，破坏稳定性
```

**复杂度与性质：**

- Best/Average/Worst：$O(n^2)$
- Auxiliary Space：$O(1)$
- Stable：No

**Q：如何解决破坏稳定性的问题？**

A：不要直接交换，改用插入或移动的方式，将最小值插入到正确位置并保持相等元素的相对顺序

## 3. 冒泡排序

### ① 基本思想

从后往前，若某元素比其前驱小，则交换它们

### ② 伪代码

```pseudocode Bubble-Sort(A)
for i = 1 to A.length - 1 do
    noswap = TRUE
    for j = A.length - 1 downto i do
        if A[j + 1] < A[j] then
            A[j] ↔ A[j + 1]
            noswap = FALSE
    if noswap then break
@note 选中的元素不断向前移动，形似与水中的气泡向上浮
```

**复杂度与性质：**

- Best：$O(n)$
- Average/Worst：$O(n^2)$
- Auxiliary Space：$O(1)$
- Stable：Yes

# 三、高效排序算法

## 1. 希尔排序

### ① 基本思想

希尔排序是插入排序的改进版：先让数组"基本有序"，再用插入排序收尾

具体做法：取一个增量 $d$，把相隔 $d$ 的元素分成一组，对每组做插入排序；然后逐渐减小 $d$，直到 $d = 1$ 时做最后一次标准插入排序

### ② 伪代码

```pseudocode Shell-Pass(A, d)
for i = d + 1 to n do
    if A[i] < A[i - d] then
        key = A[i]              //待插入的元素
        j = i - d
        while j > 0 and key < A[j] do
            A[j + d] = A[j]     //后移 d 位
            j = j - d
        A[j + d] = key
@note 每一个希尔排序阶段：插入排序
```

```pseudocode Shellsort(A, D)
for increment in D do
    Shell-Pass(A, increment)
@note 主程序，D 为增量序列，里面包含每一个希尔排序阶段确定的增量 d
```

**Q：为什么要选择希尔排序？**

A：插入排序的局限性在于，每次只能将元素移动一个距离，如果元素在另一边，那移动次数就几乎等于整个存储结构长度，使得总移动次数变多。而希尔排序能让部分元素一次移动一大步，快速到达大致位置，再逐步精细化，就能大幅减少总移动次数

**复杂度与性质：**

- Best/Average/Worst：均取决于增量序列 $D$ 的选取
- Auxiliary Space：$O(1)$
- Stable：No

### ③ 增量序列的选取

|$d$|时间复杂度|
|:----:|:----:|
|$⌈\frac{n}{2^k}⌉$|$\Theta(n^2)$|
|$2⌊\frac{n}{2k+1}⌋+1$|$\Theta(n^{\frac{3}{2}})$|
|$2^k-1$|$\Theta(n^{\frac{3}{2}})$|
|$2^k+1$|$\Theta(n^{\frac{3}{2}})$|
|数字连续选取的 $2^p\times 3^q$ $p,q\in \Bbb{N}$|$O(nlog^2n)$|

> 增量序列必须递减，且最后一个必须是 1，否则数组不能完全有序

## 2. 堆排序

### ① 堆

**最大堆**

子节点的元素值小于等于父节点的元素值

> 在数组表示的最大堆结构中，叶子节点的索引为 $(⌊A.length/2⌋ + 1,n)$

### ② 基本思想

反复把堆顶（当前最大值）与堆的最后一个元素交换，然后缩小堆、修复堆，直到堆中只剩一个元素

这与选择排序的思想一致：每次选出当前最大值，放到最终位置

### ③ 伪代码

```pseudocode Max-Heapify(A,i)
l = Left(i)
r = Right(i)
largest = i
if l ≤ A.heap-size and A[l] > A[largest]
    largest = l
if r ≤ A.heap-size and A[r] > A[largest]
    largest = r
if largest ≠ i
    A[i] ↔ A[largest]
    Max-Heapify(A, largest)
@note 最大堆维护算法
@note 假设以 Left(i) 和 Right(i) 为根的子树是最大堆，也就是说，唯一可能违反最大堆性质的节点就是 i 本身——它可能比自己的孩子小
```

```pseudocode Build-Max-Heap(A)
A.heap-size = A.length
for i = ⌊A.length / 2⌋ downto 1
    Max-Heapify(A, i)
@note 最大堆建立算法
@note 对每一个非叶子结点，按索引倒序遍历，对其执行最大堆维护算法，使得以它为根节点的子树满足最大堆的性质
```
```pseudocode Heapsort(A)
Build-Max-Heap(A)
for i = A.length downto 2
    A[1] ↔ A[i]
    A.heap-size = A.heap-size - 1
    Max-Heapify(A, 1)
@note 主程序
```
**复杂度与性质：**

- 最大堆维护：$O(\log n)$
- 最大堆建立：$O(n)$
- Best/Average/Worst：$O(n\log n)$
- Auxiliary Space：递归维护最大堆需要 $O(\log n)$，最大堆的建立需要 $O(1)$
- Stable：No

## 3. 快速排序

### ① 基本思想

分治思想：选一个主元（pivot），把数组划分成 " $\leq pivot$ " 和 " $\gt pivot$ " 两部分，再对两部分递归排序

### ② 伪代码

```pseudocode Quicksort(A,p,r)
if p <r then
    q =Partition(A,p,r)
    Quicksort(A,p,q−1)
    Quicksort(A,q+1,r)
@note 主程序
```
```pseudocode Partition(A, p, r)
x = A[r]                    // 选最后一个元素为主元
i = p - 1                   // i 是"≤ pivot"区域的右边界
for j = p to r - 1
    if A[j] ≤ x
        i = i + 1
        A[i] ↔ A[j]         // 把 ≤ pivot的元素换到左区
A[i + 1] ↔ A[r]             // 主元放到正确位置
return i + 1                // 返回主元最终下标
@note 划分
```
```pseudocode Randomized-Partition(A, p, r)
    i = Random(p, r)            // 随机选一个位置
    A[r] ↔ A[i]                 // 换到末尾，复用 Partition
    return Partition(A, p, r)

Randomized-Quicksort(A, p, r)
    if p < r
        q = Randomized-Partition(A, p, r)
        Randomized-Quicksort(A, p, q - 1)
        Randomized-Quicksort(A, q + 1, r)
```
**复杂度与性质：**
```fold 时间复杂度分析
1. 最差情况 
每次划分产生 n−1 和 0 两个子问题时：
$$
\begin{aligned}
T(n) &= T(n-1) + T(0) + \Theta(n) \\
     &= T(n-1) + \Theta(n) \\
     &= \Theta(n^2)
\end{aligned}
$$
2. 最好情况和一般情况
$$
\begin{aligned}
T(n) &= T(\frac{n}{10}) + T(\frac{9n}{10}) + Θ(n) \\
     &= Θ(n\log n)
\end{aligned}\\
$$
递归树深度是 O(log n)，每层代价 O(n)
```
- Worst：$\Theta(n^2)$ 
- Best/Average：$O(n\log n)$
- Stable：No
# 附录

### 算法可视化
[快速排序](https://www.bilibili.com/video/BV1j841197rQ/)
[算法演示网站](https://www.toptal.com/developers/sorting-algorithms)

### Data Structure：堆

[堆从堆的定义到优先队列、堆排序](https://www.bilibili.com/video/BV1AF411G7cA/?spm_id_from=333.337.search-card.all.click&vd_source=48774b7554e5a85d4e1f4c5ffe0b7966)
